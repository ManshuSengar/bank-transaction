import { FieldArray, Form, Formik } from "formik";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Grid, IconButton, Snackbar } from "@mui/material";
import { Delete } from '@mui/icons-material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import { FixedSizeList } from 'react-window';
import { connect } from 'react-redux';
import { useDeleteLenderLimitByIdMutation, useGetLenderLimitFormDataQuery, useSaveLenderLimitFormDataMutation } from "../../../features/application-form/capitalResourceForm";
import AutoSave from "../../../components/framework/AutoSave";
import { TextBoxField } from "../../../components/framework/TextBoxField";
import FormLoader from "../../../loader/FormLoader";
import { EnhancedDropDown } from "../../../components/framework/EnhancedDropDown";
import { useAppSelector } from "../../../app/hooks";
import ConfirmationAlertDialog from "../../../models/application-form/ConfirmationAlertDialog";
import { OnlineSnackbar } from "../../../components/shared/OnlineSnackbar";
import { MultipleLenderDropDown } from "../commonFiles/MultipleLenderDropDown";
import * as Yup from 'yup';
import FullScreenLoaderNoClose from "../../../components/common/FullScreenLoaderNoClose";
import { useGetMaterQuery } from "../../../features/master/api";
import { modify } from "../../../utlis/helpers";
import { useUpdateCommentByNIdMutation } from "../../../features/application-form/applicationForm";
import NotificationSectionWiseButton from "../../../components/DrawerComponent/NotificationSectionWiseButton";
import DrawerResponseComponent from "../../../components/DrawerComponent/DrawerResponseComponent";
import Notification from "../../../components/shared/Notification";

interface LenderRow {
    lenderName: string;
    lenderType: string | null;
    limitType: string;
    sanctionedLimit: number | null;
    fundingAmtTMinus2: number | null;
    fundingAmtTMinus1: number | null;
    fundingAmtT: number | null;
    avgIntRate: number | null;
    totalExposure: number | null;
    latestIntRate: number | null;
    contactDetails: string;
    ncdOs: string;
    security: string;
    slNo: number | null;
    saveStatus: string;
    applId: string;
}

interface FormValues {
    data: LenderRow[];
}

interface Props {
    applId: string;
    excelData: any[];
    openSectionsData?: any[];
}

const LenderLimitOdForm = ({ applId, excelData, openSectionsData }: Props) => {
    const [addLimitDetails] = useSaveLenderLimitFormDataMutation();
    const { data: LimitData, isLoading, isError, refetch } = useGetLenderLimitFormDataQuery(applId, { skip: !applId, refetchOnMountOrArgChange: true });
    const [deleteLimitDetails] = useDeleteLenderLimitByIdMutation();
    const [index, setIndex] = useState(0);
    const [openConfirmation, setOpenConfirmation] = useState(false);
    const [formData, setFormData] = useState<LenderRow[] | null>(null);
    const [actionVal, setActionVal] = useState<string | null>(null);
    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<string>("");
    const [severity, setSeverity] = useState<"success" | "error">("success");
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [snackOpen, setSnackOpen] = useState(false);
    const [snackMessages, setSnackMessages] = useState<string[]>([]);
    const [snackSeverity, setSnackSeverity] = useState<"error" | "success" | "info">("error");
    const { transactionData } = useAppSelector((state) => state.userStore);
    const [initialValues, setInitialValues] = useState<FormValues>({ data: [] });

    // Removed width for "Type of FI" (previously 150 at index 4)
    const columnWidths = [60, 60, 250, 150, 170, 170, 180, 180, 180, 170, 170, 320, 120, 120];

    useEffect(() => {
        if (LimitData) {
            const dataWithApplId: LenderRow[] = LimitData.map((item: any) => ({
                ...item,
                applId
            }));
            setInitialValues({ data: dataWithApplId });
        }
    }, [LimitData, applId]);

    useEffect(() => {
        if (excelData && excelData.length > 0) {
            let newExcelData = excelData.slice(1);
            const lenderRows = newExcelData.filter((row: any) => row[2] && row[2] !== 'Total');
            const newData: LenderRow[] = lenderRows.map((excelRow: any) => ({
                lenderName: excelRow[2]?.toString().trim() || "",
                limitType: excelRow[3]?.toString().trim() || "",
                lenderType: excelRow[4]?.toString().trim() || null,
                sanctionedLimit: parseExcelValue(excelRow[5]),
                fundingAmtTMinus2: parseExcelValue(excelRow[6]),
                fundingAmtTMinus1: parseExcelValue(excelRow[7]),
                fundingAmtT: parseExcelValue(excelRow[8]),
                totalExposure: parseExcelValue(excelRow[9]),
                avgIntRate: parseExcelValue(excelRow[10]),
                latestIntRate: parseExcelValue(excelRow[11]),
                contactDetails: excelRow[12]?.toString().trim() || "",
                ncdOs: excelRow[13]?.toString().trim() || "",
                security: excelRow[14]?.toString().trim() || "",
                slNo: null,
                saveStatus: '01',
                applId
            }));
            setInitialValues({ data: newData });
            setOpenSnackbar(true);
            setSeverity("success");
            setSnackMsg("Lender data imported successfully");
        }
    }, [excelData, applId]);

    const parseExcelValue = (value: any): number => {
        if (value === undefined || value === null || value === '') return 0;
        if (typeof value === 'string') return parseFloat(value.replace(/,/g, '')) || 0;
        return parseFloat(value) || 0;
    };

    const extractErrorMessages = (errorResponse: Record<string, string>) => {
        const allMessages = Object.values(errorResponse)
            .flatMap(msg => msg.split(',').map(m => m.trim()));
        return allMessages;
    };

    const handleSubmitApis = async (values: FormValues | LenderRow[]) => {
        try {
            const requestBody = Array.isArray(values) ? values : values.data;
            setIsUploading(true);
            if (await addLimitDetails(requestBody).unwrap()) {
                setOpenSnackbar(true);
                setIsUploading(false);
                setSeverity("success");
                setSnackMsg(requestBody[0]?.saveStatus === '02' ? "Section submitted successfully" : "Record saved successfully");
                setActionVal(null);
                return true;
            }
            return false;
        } catch (err: any) {
            console.error(err);
            setIsUploading(false);
            if (err.status === 400 && err.message === "Invalid") {
                const errorMessages = extractErrorMessages(err.customCode);
                setSnackMessages(errorMessages.length > 0 ? errorMessages : ["Validation failed."]);
                setSnackSeverity('error');
                setSnackOpen(true);
            } else {
                console.error(err);
            }
            return false;
        }
    };

    const handleClosePop = () => setOpenSnackbar(false);

    const { data: bankMasterData, isLoading: isBankMasterLoading } = useGetMaterQuery(`refapi/mstr/getBankMasters`);
    const bankOptions = useMemo(() => bankMasterData ? modify("mstr/getBankMasters", bankMasterData) : [], [bankMasterData]);

    const { data: limitTypeData, isLoading: isLimitTypeLoading } = useGetMaterQuery(`refapi/mstr/getLimitType`);
    const limitTypeOptions = useMemo(() => limitTypeData ? modify("mstr/getLimitType", limitTypeData) : [], [limitTypeData]);

    const handleDelete = async (applId: string, index: number) => {
        handleClose();
        try {
            if (await deleteLimitDetails({ applId, index }).unwrap()) {
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg("Record Deleted successfully");
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Error saving compliance position:", error);
            setOpenSnackbar(true);
            setSeverity("error");
            setSnackMsg("failed to save : " + error?.message);
            return false;
        }
    };

    const handleClickOpen = (index: number) => {
        setIndex(index);
        setOpen(true);
    };

    const calculateSanTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1.sanctionedLimit) || 0);
        }, 0);
    };

    const calculateFy2Total = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1.fundingAmtTMinus2) || 0);
        }, 0);
    };

    const calculateFy1Total = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1.fundingAmtTMinus1) || 0);
        }, 0);
    };

    const calculateFyTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1.fundingAmtT) || 0);
        }, 0);
    };

    const calculateNcdTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1.ncdOs) || 0);
        }, 0);
    };

    const calculatetotalExposureTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1.totalExposure) || 0);
        }, 0);
    };
    const odListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                lenderName: Yup.string().required('Required'),
                limitType: Yup.string().required('Required'),
                // lenderType: Yup.string().required('Required'),
            })
        ),
    });

    const handleClose = () => setOpen(false);

    const handleCloseConfirmation = () => {
        setActionVal(null);
        setOpenConfirmation(false);
    };

    const handleSubmitConfirmation = (values: LenderRow[]) => {
        setOpenConfirmation(false);
        handleSubmitApis(values);
    };

    const handleSubmit = async (values: FormValues) => {
        const finalValue = values.data.map((listData: any, index: number) => ({
            ...listData,
            applId,
            slNo: index + 1,
            saveStatus: actionVal
        }));
        if (actionVal === '02') {
            setFormData(finalValue);
            setOpenConfirmation(true);
        } else {
            handleSubmitApis(finalValue);
        }
        setActionVal(null);
    };

    const handleClickSetAction = (action: string) => setActionVal(action);

    const handleSnackbarCloseSnack = () => setSnackOpen(false);

    const renderRow = ({ index, style, data }: { index: number; style: any; data: { values: FormValues; setFieldValue: any } }) => {
        const { values, setFieldValue } = data;
        const row = values.data[index];
        const selectedLimitType = limitTypeOptions.find((option: any) => option.value === row.limitType);
        const lenderTypeOptionsForRow = selectedLimitType ? selectedLimitType.lenderType.map((type: string) => ({
            key: type,
            value: type,
            label: type
        })) : [];

        return (
            <div style={{ ...style, display: 'flex' }} className="div-table-row">
                {columnWidths.map((width, colIndex) => (
                    <div key={colIndex} style={{ width: `${width}px`, flexShrink: 0, padding: '8px' }} className="div-table-cell">
                        {colIndex === 0 && (
                            <IconButton
                                className="text-danger"
                                disabled={row.saveStatus === '02'}
                                onClick={() => row.slNo ? handleClickOpen(row.slNo) : values.data.splice(index, 1)}
                            >
                                <Delete />
                            </IconButton>
                        )}
                        {colIndex === 1 && <span>{index + 1}</span>}
                        {colIndex === 2 && (
                            <MultipleLenderDropDown
                                label=""
                                name={`data.${index}.lenderName`}
                                domain=""
                                disabled={row.saveStatus === '02'}
                                options={bankOptions}
                                isLoading={isBankMasterLoading}
                                onSelect={(selected) => {
                                    setFieldValue(`data.${index}.lenderType`, selected ? selected.tag : null);
                                }}
                            />
                        )}
                        {colIndex === 3 && (
                            <Grid item xs={12}>
                                <EnhancedDropDown
                                    label=""
                                    name={`data.${index}.limitType`}
                                    disabled={row.saveStatus === '02'}
                                    customOptions={limitTypeOptions}
                                    domain=""
                                />
                            </Grid>
                        )}
                        {colIndex === 4 && (
                            <TextBoxField
                                name={`data.${index}.sanctionedLimit`}
                                type="number"
                            />
                        )}
                        {colIndex === 5 && (
                            <TextBoxField
                                name={`data.${index}.fundingAmtTMinus2`}
                                type="number"
                            />
                        )}
                        {colIndex === 6 && (
                            <TextBoxField
                                name={`data.${index}.fundingAmtTMinus1`}
                                type="number"
                            />
                        )}
                        {colIndex === 7 && (
                            <TextBoxField
                                name={`data.${index}.fundingAmtT`}
                                type="number"
                            />
                        )}
                        {colIndex === 8 && (
                            <TextBoxField
                                name={`data.${index}.totalExposure`}
                                type="number"
                            />
                        )}
                        {colIndex === 9 && (
                            <TextBoxField
                                name={`data.${index}.avgIntRate`}
                                type="number"
                            />
                        )}

                        {colIndex === 10 && (
                            <TextBoxField
                                name={`data.${index}.latestIntRate`}
                                type="number"
                            />
                        )}
                        {colIndex === 11 && (
                            <TextBoxField
                                name={`data.${index}.contactDetails`}
                            />
                        )}
                        {colIndex === 12 && (
                            <TextBoxField
                                name={`data.${index}.ncdOs`}
                                type="number"
                            />
                        )}
                        {colIndex === 13 && (
                            <TextBoxField
                                name={`data.${index}.security`}
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const [updateCommentByNId] = useUpdateCommentByNIdMutation();
    const { opensections } = useAppSelector((state) => state.userStore);
    const [getOpenSectionsData, setOpenSections] = useState<any[]>([]);
    const [open, setOpen] = useState<any>(false);
    const [getNotiId, setNotiId] = useState<any>('');
    const [openDr, setOpenDr] = useState<any>(false);

    const toggleDrawer = (newOpen: boolean) => () => {
        setOpenDr(true);
    };
    const handleButtonClick = (notfId: any) => {
        setOpenDr(true);
        setNotiId(notfId);
    };
    useEffect(() => {
        if (opensections && opensections.length > 0) {
            setOpenSections(opensections);
        }
    }, [opensections]);
    if (isLoading) return <FormLoader />;
    if (isUploading) return <FullScreenLoaderNoClose />;

    return (
        <>
            {!transactionData ?
                <Notification /> : <>
                    <Grid item xs={12} className="opensections-sticky-css">
                        <Grid
                            className="pb-0"
                            item
                            xs={12}
                            display="flex"
                            justifyContent="end">
                            {getOpenSectionsData && getOpenSectionsData.length > 0 && (() => {
                                const matchedItem = getOpenSectionsData.find(
                                    (item: any) => item?.sectionId === "09" && item?.subSectionId === "03"
                                );
                                return matchedItem ? (
                                    <div className="openSection-item">
                                        <NotificationSectionWiseButton
                                            label="Respond"
                                            handleClick={() => handleButtonClick(matchedItem?.notfId)}
                                            className="btn-primary-css--"
                                            notfId={matchedItem?.notfId}
                                            getOpenSectionsData={getOpenSectionsData}
                                        />
                                    </div>
                                ) : null;
                            })()}
                            <DrawerResponseComponent
                                open={openDr}
                                toggleDrawer={toggleDrawer}
                                notfId={getNotiId}
                                detailsData={''}
                                postDataTrigger={updateCommentByNId}
                                setOpen={setOpenDr}
                            />
                        </Grid>
                    </Grid>
                    <div className="wrap-appraisal-area">
                        <Snackbar
                            open={snackOpen}
                            autoHideDuration={6000}
                            onClose={handleSnackbarCloseSnack}
                            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                        >
                            <Alert onClose={handleSnackbarCloseSnack} severity={snackSeverity} sx={{ width: '100%' }}>
                                <ul className="list-unstyled">
                                    {snackMessages && snackMessages.length > 0 ? snackMessages.map((msg: any, i: number) => (
                                        <li key={i} className="text-danger">{`(${i + 1})`} {msg} </li>
                                    )) : ''}
                                </ul>
                            </Alert>
                        </Snackbar>
                        <div className="custome-form">
                            <ConfirmationAlertDialog
                                id={1}
                                type={4}
                                open={openConfirmation}
                                handleClose={handleCloseConfirmation}
                                handleDelete={handleSubmitConfirmation}
                                values={formData}
                            />
                            <ConfirmationAlertDialog
                                id={2}
                                index={index}
                                type={2}
                                open={open}
                                handleClose={handleClose}
                                handleDelete={handleDelete}
                            />
                            <div className="wrap-inner-table" style={{ overflow: 'auto' }}>
                                <Formik
                                    initialValues={initialValues}
                                    onSubmit={handleSubmit}
                                    enableReinitialize={true}
                                    validationSchema={odListingSchema}
                                    validateOnChange={true}
                                    validateOnBlur={true}
                                >
                                    {({ values, setFieldValue }) => {
                                        const sanTotal = useMemo(() => calculateSanTotal(values), [values]);
                                        const fy2Total = useMemo(() => calculateFy2Total(values), [values]);
                                        const fy1Total = useMemo(() => calculateFy1Total(values), [values]);
                                        const fyTotal = useMemo(() => calculateFyTotal(values), [values]);
                                        const ncdTotal = useMemo(() => calculateNcdTotal(values), [values]);
                                        const exposureTotal = useMemo(() => calculatetotalExposureTotal(values), [values]);

                                        const itemCount = values.data.length;
                                        const ITEM_SIZE = 50;
                                        const MAX_HEIGHT = 500;
                                        const calculatedHeight = Math.min(itemCount * ITEM_SIZE, MAX_HEIGHT);

                                        return (
                                            <Form>
                                                <fieldset disabled={values?.data?.[0]?.saveStatus === "02"}>
                                                    {values?.data?.[0]?.saveStatus !== "02" && (
                                                        <AutoSave handleSubmit={handleSubmit} values={values} debounceMs={10000} />
                                                    )}
                                                    <FieldArray name="data">
                                                        {({ push }) => (
                                                            <>
                                                                {values?.data?.[0]?.saveStatus !== "02" && (
                                                                    <Button
                                                                        type="button"
                                                                        size='small'
                                                                        className='psn_btn text-capitalize my-2 saveBtn'
                                                                        variant="contained"
                                                                        color="primary"
                                                                        style={{ marginLeft: '15px', display: 'block' }}
                                                                        onClick={() =>
                                                                            push({
                                                                                applId: applId,
                                                                                slNo: values.data.length,
                                                                                limitType: '',
                                                                                lenderType: null,
                                                                                sanctionedLimit: null,
                                                                                lenderName: '',
                                                                                fundingAmtTMinus2: null,
                                                                                fundingAmtTMinus1: null,
                                                                                fundingAmtT: null,
                                                                                avgIntRate: null,
                                                                                totalExposure: null,
                                                                                latestIntRate: null,
                                                                                ncdOs: '',
                                                                                contactDetails: '',
                                                                                security: '',
                                                                                saveStatus: ''
                                                                            })
                                                                        }
                                                                    >
                                                                        Add <AddCircleIcon />
                                                                    </Button>
                                                                )}
                                                                <div className="table-ui div-table">
                                                                    <div style={{ display: 'flex' }} className="div-table-row div-table-header">
                                                                        {columnWidths.map((width, i) => (
                                                                            <div key={i} style={{ width: `${width}px`, flexShrink: 0, padding: '8px' }} className="div-table-cell">
                                                                                {i === 0 && <b>Action</b>}
                                                                                {i === 1 && <b style={{ minWidth: '50px', display: 'inline-block' }}>Sr. No.</b>}
                                                                                {i === 2 && <b>Name of the Bank/ lender</b>}
                                                                                {i === 3 && <b>Limit Type</b>}
                                                                                {i === 4 && <b>Sanctioned Limit</b>}
                                                                                {i === 5 && <b>Funding received in FY {transactionData?.lstAudYrTm2}</b>}
                                                                                {i === 6 && <b>Funding received in FY {transactionData?.lstAudYrTm1}</b>}
                                                                                {i === 7 && <b>Funding received in FY {transactionData?.lstAudYrT}</b>}
                                                                                {i === 8 && <b>Total Exposure</b>}
                                                                                {i === 9 && <b>Avg rate of interest</b>}
                                                                                {i === 10 && <b>Latest rate of interest</b>}
                                                                                {i === 11 && <b>Contact details of lenders</b>}
                                                                                {i === 12 && <b>NCD – o/s</b>}
                                                                                {i === 13 && <b>Security</b>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    {values.data.length > 0 ? (
                                                                        <div style={{ flex: 1 }}>
                                                                            <FixedSizeList
                                                                                className="table-list-container"
                                                                                height={calculatedHeight}
                                                                                itemCount={values.data.length}
                                                                                itemSize={ITEM_SIZE}
                                                                                width="100%"
                                                                                itemData={{ values, setFieldValue }}
                                                                            >
                                                                                {renderRow}
                                                                            </FixedSizeList>
                                                                        </div>
                                                                    ) : null}

                                                     
                                                                    <div style={{ display: 'flex' }} className="div-table-row">
                                                                        <div style={{ width: `${columnWidths[0]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[1]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[2]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        {/* <div style={{ width: `${columnWidths[3]}px`, flexShrink: 0 }} className="div-table-cell"></div> */}
                                                                        <div style={{ width: `${columnWidths[4]-20}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell"><b>Total</b></div>
                                                                        <div style={{ width: `${columnWidths[5]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{sanTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[6]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{fy2Total.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[7]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{fy1Total.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[8]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{fyTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[9]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{exposureTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[10]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                         <div style={{ width: `${columnWidths[3]+20}px`, flexShrink: 0 }} className="div-table-cell"></div>

                                                                        <div style={{ width: `${columnWidths[11]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[12]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{ncdTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[13]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                       
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </FieldArray>
                                                </fieldset>
                                                {
                                                    values?.data?.[0]?.saveStatus !== "02" && (
                                                        <>
                                                            <Button
                                                                className="sbmtBtn psn_btn mt-3 mb-3 ms-3"
                                                                type='submit'
                                                                onClick={() => handleClickSetAction('01')}
                                                                variant="contained"
                                                            >
                                                                Save <CheckCircleOutlineIcon />
                                                            </Button>
                                                            <Button
                                                                className="sbmtBtn sbmtBtn_scn psn_btn mt-3 mb-3 ms-3"
                                                                type='submit'
                                                                onClick={() => handleClickSetAction('02')}
                                                                variant="contained"
                                                            >
                                                                Submit <SaveAsIcon />
                                                            </Button>
                                                        </>
                                                    )
                                                }
                                            </Form>
                                        );
                                    }}
                                </Formik>
                            </div>
                            <OnlineSnackbar open={openSnackbar} msg={snackMsg} severity={severity} handleSnackClose={handleClosePop} />
                        </div>
                    </div></>}
        </>
    );
};

export default connect((state: any) => ({
    applId: state.userStore.applId
}))(LenderLimitOdForm);



import { STATUS } from "./constants";
// Helper function
export function showFileFromByteArray(byteArray: string, mimeType: string) {
  const byteCharacters = atob(byteArray);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray1 = new Uint8Array(byteNumbers);
  const file = new Blob([byteArray1], { type: mimeType });
  const fileURL = URL.createObjectURL(file);
  window.open(fileURL);
}


export const getTime = (): number => {
  return new Date().getTime();
};

export const modify = (domain: string, masterData: any) => {
  let master: any = [];
  switch (domain) {
    case "mstr/businessNature":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.natCd,
          value: item.natDesc,
        }));

      return master;
    case "mstr/getKmpType": master =
      masterData &&
      masterData.map((item: any) => ({
        key: item.slNo,
        value: item.particulars,
      }));

      return master;

    case "mstr/getNbfcMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.nbfcCifCd,
          value: `${item.nbfcName}-${item.nbfcCifCd}-${item.nbfcId}-${item.nbfcPanNo}`,
          label: item.nbfcName,
        }));
      return master;

    case "mstr/loanPurpose":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.purCd,
          value: item.purDesc,
        }));
      return master;
    case "mir/getMirPnfList":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.mirId,
          value: `${item.customerDetails}-${item.mirValidTo}-${item.mirRefNO}-${item.cifCd}`,
          label: `${item.customerDetails}-${item.mirValidTo}`,
        }));
      return master;

    case "mstr/getScheme":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.schCd,
          value: `${item.schLongName}`,
        }));
      return master;

    case "mstr/getCovenantMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.covenant}`,
          label: `${item.covenant}`,
        }));
      return master;

    case "mstr/getApprlCoventOpertr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.operator}`,
          label: `${item.operator}`,
        }));
      return master;

    case "mstr/getBenchMark":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.BRM_RATE_ID,
          value: `${item.BRM_RATE_ID}`,
          label: `${item.BRM_RATE_NAME}`
        }));
      return master;

    case "committee/getAllCommitteeMasters":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.commId,
          value: `${item.commId}`,
          label: `${item.commName}`,
        }));

      return master;

    case "committee/getAllMemberRoles":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.roleId,
          value: `${item.roleName}`,
        }));

      return master;

    case "minutes/getAllUsers":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.userId,
          value: `${item.userName}-${item.userEmpId}-${item.userDesgn}`,
          label: `${item.userName}`,
        }));

      return master;


    case "mstr/getFundMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.fundCode,
          value: `${item.fundDesc}`,
        }));
      return master;

    case "mstr/getStockExchange":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.exchangeType,
          label: item?.exchangeType,
        }));
      return master;

    case "mstr/getRatingAgency":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.agencyDet,
          value: `${item.agencyDet}`,
          label: item.agencyDet
        }));
      return master;

    case "mstr/getRatingCode":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.ratingDet,
          value: `${item.ratingDet}`,
          label: item.ratingDet
        }));
      return master;

    case "mstr/getAppraGradingCovent":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.gradingValue}`,
          label: `${item.gradingValue}`,
        }));
      return master;

    case "committee/getLosAgendaPurpose":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.prpsCd,
          value: `${item.prpsDesc}`,
        }));
      return master;

    case "minutes/getAgendaStatusMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.statusCd,
          value: `${item.statusDesc}`,
        }));
      return master;


    case "minutes/getNBFCApprovedUsersData":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.applId,
          value: `${item.nbfcName}`,
        }));
      return master;

    case "appl/getProdMstr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.prodId,
          value: item.prodId,
          label: item?.prodDesc,
        }));
      return master;

    case "appl/getProdSchemeMstr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.schCd,
          value: item.schCd,
          label: item?.schLongName,
        }));
      return master;

    case "appl/getProdAssistType":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.assistType,
          value: item.assistType,
          label: item?.assistType,
        }));
      return master;



    case `dueDiligence/parentOrHolding`:
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.ddId,
          value: item.ddId,
          label: item?.entityName,
        }));
      return master;

    case "mstr/getConstitution":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item.id,
          label: item?.name,
        }));
      return master;

    case "mstr/getclassification":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.classCd,
          value: item.classCd,
          label: item?.classDesc,
        }));
      return master;

    case "mstr/getLenderType":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.particulars,
          label: item?.particulars,
        }));
      return master;

    case "mstr/getBorrowParticulars":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.particulars,
          label: item?.particulars,
        }));
      return master;


    case "mstr/getIndividualParticular":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.particulars,
          label: item?.particulars,
        }));
      return master;

    case "mstr/getBankMasters":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item.bankName,
          label: item?.bankName,
          bankTag:item?.bankTag,
          tag:item?.tag,
        }));
      return master;

    case "mstr/getStateMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.stateCode,
          value: item.stateName,
          label: item?.stateName,
        }));
      return master;

    case "mstr/getKmpDesignation":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.desgnDesc,
          label: item?.desgnDesc,
        }));
      return master;

    case "mstr/getPortfolioTrnxMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item.constTypes,
          label: item?.constTypes,
        }));
      return master;

    case "mstr/getNbfcLayerTypes":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.nbfcLayerId,
          value: item.nbfcLayerId,
          label: item?.nbfcLayerName,
        }));
      return master;

    case "mstr/getNbfcTypes":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.nbfcTypeId,
          value: item?.nbfcTypeId,
          label: item?.nbfcTypeName,
        }));
      return master;

    case "mstr/getAuditedYears":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item?.year,
          label: item?.year,
        }));
      return master;

    case "mstr/getYearMaster":
      master = masterData?.map((item: any) => ({
        key: item?.slNo,
        value: item.periodName,
        label: item?.periodName,
      }));
      return master;

    case "appl/getIndvShareDetails":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item?.value,
          label: item?.value,
        }));
      return master;

    case "mstr/getUnauditedQuarter":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item?.qtrName,
          label: item?.qtrName,
        }));
      return master;

    case "mstr/getRepayFreq":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.slNo}`,
          label: `${item.particulars}`,
        }));
      return master;

    case "mstr/getProduct":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.prodId,
          value: `${item.prodId}`,
          label: `${item.prodDesc}`,
        }));
      return master;

    case "mstr/getFacilityTypeMstr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.slNo}`,
          label: `${item.facilityType}`,
        }));
      return master;

    case "mstr/getResetClauseMstr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.slNo}`,
          label: item.resetClauseDesc
        }));
      return master;

    case "mstr/getPastAsationMster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.id,
          value: `${item.id}`,
          label: item.particulars
        }));
      return master;

    case "mstr/getProdCutType":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.id,
          value: `${item.id}`,
          label: item.product
        }));
      return master;

    case "mstr/getLimitType":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.particulars}`,
          label: item.particulars,
          lenderType:item.lenderType,
        }));
      return master;

    default:
  }
};

export const statusCode: any = (status: any) => {
  return STATUS[status];
};

export const getStatusCodeValue: any = (value: any) => {
  const object = STATUS;
  return Object.keys(object).find((key) => object[key] === value);
};

// Defined the function to check if string is checkSplittable 
export const checkSplittable = (inputString: string) => {
  return inputString.length % 4 !== 0 ? false : (() => {
    const regex = new RegExp(`.{${inputString.length / 4}}`, 'g');
    const segments = inputString.match(regex);
    return segments && new Set(segments).size === 4;
  })();
};
//End checkSplittable 

import React, { useMemo } from "react";
import { KeyValuePair } from "../../../components/framework/KeyValuePair";
import { getIn, useFormikContext } from "formik";
import Typography from "@mui/material/Typography";
import { Autocomplete, TextField, Grid } from "@mui/material";
import { useGetMaterQuery } from "../../../features/master/api";
import { modify } from "../../../utlis/helpers";
import SelectLoader from "../../../loader/SelectLoader";

export const MultipleLenderDropDown = (props: {
  label?: string;
  name: string;
  domain: string;
  disabled?: boolean;
  options?: any[];
  isLoading?: boolean;
  onSelect?: (selected: any) => void; 
}) => {
  const {
    handleBlur,
    values,
    touched,
    errors,
    setFieldValue
  } = useFormikContext<KeyValuePair>() || {};

  const {
    data: masterData,
    isLoading: isMasterLoadingInternal,
    error: masterError,
  } = props.options
    ? { data: props.options, isLoading: false, error: null }
    : useGetMaterQuery(`refapi/${props.domain}`, {
        refetchOnMountOrArgChange: true
      });

  const options = useMemo(() => {
    if (props.options) {
      return props.options.map((item: any) => ({
        key: item.key,
        value: item.value,
        label: item.label || item.value,
        tag: item.tag, 
        bankTag: item.bankTag 
      }));
    }

    return modify(props.domain, masterData)?.map((item: any) => ({
      key: item.key,
      value: props.domain !== "mir/getMirPnfList" ? item.value : item.key,
      label: item.label || item.value,
      tag: item?.tag, 
      bankTag: item?.bankTag 
    })) || [];
  }, [masterData, props.domain, props.options]);

  const currentValue = useMemo(() => {
    return options.find(
      (option: any) => option.value === getIn(values, props.name)
    ) || null;
  }, [options, values, props.name]);

  const isLoading = props.isLoading !== undefined
    ? props.isLoading
    : isMasterLoadingInternal;

  if (isLoading) return <SelectLoader />;

  return (
    <Grid item xs={12}>
      <Autocomplete
        sx={{
          "& .MuiOutlinedInput-root": {
            paddingRight: "20px!important",
            paddingLeft: "0px!important",
            paddingTop: "0px!important",
            paddingBottom: "0px!important",
          },
        }}
        fullWidth
        options={options}
        value={currentValue}
        disabled={props?.disabled}
        loading={isLoading}
        onChange={(_, newValue) => {
          setFieldValue(props.name, newValue ? newValue.value : null);
          if (props.onSelect) {
            props.onSelect(newValue); 
          }
        }}
        onBlur={handleBlur}
        getOptionLabel={(option) => option.label}
        renderInput={(params) => (
          <TextField
            {...params}
            name={props.name}
            label={props.label}
            variant="outlined"
            sx={{
              padding: 0
            }}
          />
        )}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        filterOptions={(options, { inputValue }) =>
          options.filter(option =>
            option.label.toLowerCase().includes(inputValue.toLowerCase())
          )
        }
      />
      <Grid item xs={12}>
        <Typography
          color="error"
          variant="subtitle2"
          gutterBottom
          component="span"
          className="mybooking_error"
        >
          {getIn(errors, props.name) &&
            JSON.stringify(getIn(errors, props.name)).replaceAll('"', "")
          }
        </Typography>
      </Grid>
    </Grid>
  );
};

import { KeyValuePair } from "./KeyValuePair";
import { getIn, useFormikContext } from "formik";
import Typography from "@mui/material/Typography";
import Select from "@mui/material/Select";
import { useGetMaterQuery, useLazyGetMasterByIdQuery } from "../../features/master/api";
import { modify } from "../../utlis/helpers";
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import { useEffect, useState } from "react";
import SelectLoader from "../../loader/SelectLoader";
import { Backdrop, CircularProgress } from "@mui/material";

interface EnhancedDropDownProps {
    label?: string;
    name: string;
    domain: string;
    disabled?: boolean;
    dependsOn?: any;
    onChange?: (value: any) => void;
    onValueChange?: (value: any) => void;
    customOptions?: Array<{ key: string, value: string, label: string }>;
    valueKey?: string;
    labelKey?: string;
    query?: string;
    basePath?: string
}

export const EnhancedDropDown =
    ({
        basePath = "refapi",
        ...props
    }: EnhancedDropDownProps) => {
        const formik = useFormikContext<KeyValuePair>();
        const {
            handleBlur,
            values,
            touched,
            errors,
            setFieldValue,
            setFieldTouched
        } = formik || {};

        const [dependMasterdata, setDependMasterData] = useState<any>();
        const {
            data: masterData,
            isLoading
        } = useGetMaterQuery(`${basePath}/${props.domain}`, {
            skip: Boolean(props.dependsOn),
            refetchOnMountOrArgChange: true
        });

        // const [dependsOnData] = useLazyGetMasterByIdQuery();

        const [dependsOnData, { data, isFetching, isLoading: isMstrLoading, error }] = useLazyGetMasterByIdQuery();


        const handleChange = async (event: any) => {
            const value = event.target.value;
            await setFieldValue(props.name, value);
            await setFieldTouched(props.name, true, false);

            if (props.onChange) {
                props.onChange(value);
            }
            if (props.onValueChange) {
                props.onValueChange(value);
            }
        };

        const dependentValue: any = getIn(values, props.dependsOn);

        const dependData = async () => {
            let options: any = [];
            if (props.dependsOn) {
                if (getIn(values, props.dependsOn)) {
                    try {
                        const dependMasterData = await dependsOnData(
                            `${basePath}/${props.domain}?${props?.query}=${dependentValue}`
                        ).unwrap();
                        options = modify(`${props.domain}`, dependMasterData);
                        return options;
                    } catch (error) {
                        return [];
                    }
                }
                return options;
            }
            return [];
        };

        const getOptions = () => {
            if (props.customOptions) {
                return props.customOptions;
            }
            return modify(props.domain, masterData);
        };

        useEffect(() => {
            dependData()
                .then((options: any) => {
                    setDependMasterData(options);
                })
                .catch(() => {
                    setDependMasterData([]);
                });
        }, [props?.dependsOn, dependentValue]);

        // if (isLoading) return <SelectLoader />;

        return (
            <>
                {/* <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={isLoading || isFetching || isMstrLoading}>
                    <div style={{ textAlign: 'center' }}>
                        <CircularProgress color="inherit" />
                        <Typography variant="h6" sx={{ mt: 2 }}>
                            Loading, please wait...
                        </Typography>
                    </div>
                </Backdrop> */}
                <FormControl fullWidth>
                    <InputLabel
                        className="select-label"
                        id={`label-id-${props.name}`}
                        error={Boolean(getIn(touched, props.name) && getIn(errors, props.name))}
                    >
                        {props.label}
                    </InputLabel>
                    <Select
                        labelId={`label-id-${props.name}`}
                        id={`id-${props.name}`}
                        value={getIn(values, props.name) || ''}
                        disabled={props.disabled}
                        name={props.name}
                        label={props.label}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={Boolean(getIn(touched, props.name) && getIn(errors, props.name))}
                        size="small"
                    >
                        {(!props?.dependsOn ? getOptions() : dependMasterdata)?.map((item: any) => (
                            <MenuItem
                                value={item.value}
                                key={item.key}
                            >
                                {item.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <div className="mt-0 position-relative">
                    <Typography
                        color="error"
                        variant="subtitle2"
                        gutterBottom
                        component="span"
                        className="mybooking_error"
                    >
                        {getIn(touched, props.name) && getIn(errors, props.name) &&
                            JSON.stringify(getIn(errors, props.name)).replaceAll('"', '')}
                    </Typography>
                </div>
            </>
        );
    };


bank master data --> "data": [
        {
            "bankName": "Axis Bank Ltd.",
            "tag": "Private Sector Bank",
            "bankTag": "TL"
        },
        {
            "bankName": "Bandhan Bank Ltd.",
            "tag": "Private Sector Bank",
            "bankTag": "TL"
        },
        {
            "bankName": "CSB Bank Limited",
            "tag": "Private Sector Bank",
            "bankTag": "TL"
        },
        {
            "bankName": "City Union Bank Ltd.",
            "tag": "Private Sector Bank",
            "bankTag": "TL"
        },
        {
            "bankName": "DCB Bank Ltd.",
            "tag": "Private Sector Bank",
            "bankTag": "TL"
        },]


    
"data": [
        {
            "particulars": "CC",
            "slNo": 1,
            "lenderType": [
                "Public Sector Bank",
                "Private Sector Bank",
                "Foreign Bank"
            ]
        },
        {
            "particulars": "WC",
            "slNo": 2,
            "lenderType": [
                "Public Sector Bank",
                "Private Sector Bank",
                "Foreign Bank"
            ]
        },
        {
            "particulars": "OD",
            "slNo": 3,
            "lenderType": [
                "Public Sector Bank",
                "Private Sector Bank",
                "Foreign Bank"
            ]
        },
        {
            "particulars": "NCD",
            "slNo": 4,
            "lenderType": [
                "Public Sector Bank",
                "Private Sector Bank",
                "Foreign Bank",
                "NBFC / FI",
                "Others-NCD"
            ]
        },
        {
            "particulars": "Commercial Paper",
            "slNo": 5,
            "lenderType": [
                "Public Sector Bank",
                "Private Sector Bank",
                "Foreign Bank",
                "NBFC/FI",
                "Others-Commercial Paper "
            ]
        },
        {
            "particulars": "Sub-debt (including perpetual debt)",
            "slNo": 6,
            "lenderType": [
                "Public Sector Bank",
                "Private Sector Bank",
                "Foreign Bank",
                "NBFC/FI",
                "Others-Sub-debt (including perpetual debt) "
            ]
        }
    ],
    "message": "Success",
    "status": 200
}


now there is some changes limit type will come first 
limit type data now added new field lenderType so in name of bank now only those value will come which is present in lenderType  so we have to check tag basically made the changes according to that 
apart from this there is one more changes Funding received in FY 2022
Funding received in FY 2023
Funding received in FY 2024 and Avg rate of interest remove all these field and validation of these field also and give me complete and proper code 
