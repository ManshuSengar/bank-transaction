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
    // const { data: LimitData, isLoading } = useGetLenderLimitFormDataQuery(applId);
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

    const columnWidths = [60, 60, 250, 150, 170, 170, 180, 180, 180, 170, 170, 170, 120, 350];

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
            let newExcelData=excelData.slice(1);
            const lenderRows = newExcelData.filter((row: any) => row[2] && row[2] !== 'Total');
            const newData: LenderRow[] = lenderRows.map((excelRow: any) => ({
                lenderName: excelRow[2]?.toString().trim() || "",
                limitType: excelRow[3]?.toString().trim() || "",
                lenderType: excelRow[4]?.toString().trim() || null,   // swap these values
                sanctionedLimit: parseExcelValue(excelRow[5]),
                fundingAmtTMinus2: parseExcelValue(excelRow[6]),
                fundingAmtTMinus1: parseExcelValue(excelRow[7]),
                fundingAmtT: parseExcelValue(excelRow[8]),
                avgIntRate: parseExcelValue(excelRow[9]),
                latestIntRate: parseExcelValue(excelRow[10]),
                contactDetails: excelRow[11]?.toString().trim() || "",
                ncdOs: excelRow[12]?.toString().trim() || "",
                security: excelRow[13]?.toString().trim() || "",
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
        }

        catch (err: any) {
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

    const odListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                lenderName: Yup.string().required('Required'),
                limitType: Yup.string().required('Required'),
                lenderType: Yup.string().required('Required'),
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
                                    onChange={(value: any) => {
                                        setFieldValue(`data.${index}.lenderType`, '');
                                    }}
                                />
                            </Grid>
                        )}
                        {colIndex === 4 && (
                            <Grid item xs={12}>
                                <EnhancedDropDown
                                    label=""
                                    name={`data.${index}.lenderType`}
                                    disabled={row.saveStatus === '02'}
                                    customOptions={lenderTypeOptionsForRow}
                                    domain=""
                                />
                            </Grid>
                        )}

                        {colIndex === 5 && (
                            <TextBoxField
                                name={`data.${index}.sanctionedLimit`}
                                type="number"
                            />
                        )}
                        {colIndex === 6 && (
                            <TextBoxField
                                name={`data.${index}.fundingAmtTMinus2`}
                                type="number"
                            />
                        )}
                        {colIndex === 7 && (
                            <TextBoxField
                                name={`data.${index}.fundingAmtTMinus1`}
                                type="number"
                            />
                        )}
                        {colIndex === 8 && (
                            <TextBoxField
                                name={`data.${index}.fundingAmtT`}
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
                                                                                {i === 4 && <b>Type of FI</b>}
                                                                                {i === 5 && <b>Sanctioned Limit</b>}
                                                                                {i === 6 && <b>Funding received in FY-{transactionData?.lstAudYrTm2}</b>}
                                                                                {i === 7 && <b>Funding received in FY-{transactionData?.lstAudYrTm1}</b>}
                                                                                {i === 8 && <b>Funding received in FY-{transactionData?.lstAudYrT}</b>}
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
                                                                        <div style={{ width: `${columnWidths[3]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[4]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell"><b>Total</b></div>
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
                                                                        <div style={{ width: `${columnWidths[9]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[10]}px`, flexShrink: 0 }} className="div-table-cell"></div>
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
                                                {values?.data?.[0]?.saveStatus !== "02" && (
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
                                                )}
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



import { FieldArray, Form, Formik } from "formik";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Alert, Button, Grid, IconButton, Snackbar, Table, TableCell, TableHead, TableRow } from "@mui/material";
import { Delete } from '@mui/icons-material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import { FixedSizeList } from 'react-window';
import { connect } from 'react-redux';
import { useDeleteLenderTermLoanByIdMutation, useGetLenderTermLoanFormDataQuery, useSaveLenderTermLoanFormDataMutation } from "../../../features/application-form/capitalResourceForm";
import AutoSave from "../../../components/framework/AutoSave";
import { TextBoxField } from "../../../components/framework/TextBoxField";
import FormLoader from "../../../loader/FormLoader";
import { EnhancedDropDown } from "../../../components/framework/EnhancedDropDown";
import { AdvanceDatePickerField } from "../../../components/framework/EnhancedComponents";
import ConfirmationAlertDialog from "../../../models/application-form/ConfirmationAlertDialog";
import { OnlineSnackbar } from "../../../components/shared/OnlineSnackbar";
import { MultipleLenderDropDown } from "../commonFiles/MultipleLenderDropDown";
import { AdvanceTextBoxField } from "../../../components/framework/AdvanceTextBoxField";
import FullScreenLoaderNoClose from "../../../components/common/FullScreenLoaderNoClose";
import { useGetMaterQuery } from "../../../features/master/api";
import { modify } from "../../../utlis/helpers";
import * as Yup from 'yup';
import { parse, differenceInDays, isValid, format } from 'date-fns';

import NotificationSectionWiseButton from "../../../components/DrawerComponent/NotificationSectionWiseButton";
import DrawerResponseComponent from "../../../components/DrawerComponent/DrawerResponseComponent";
import { useGetBriefApplDetailsDataQuery, useUpdateCommentByNIdMutation } from "../../../features/application-form/applicationForm";
import Notification from "../../../components/shared/Notification";
import { useAppSelector } from "../../../app/hooks";
interface LenderRow {
  lenderName: string;
  lenderType: string | null;
  sancDt: string | null;
  sancAmt: number | null;
  disbDt: string | null;
  disbAmt: number | null;
  undrawnSanc: number | null;
  outstandingAmt: number | null;
  totalExposure: number | null;
  intRate: number | null;
  tenure: number | null;
  contactDetails: string | null;
  acr: number | null;
  security: string;
  corpGuarantee: string;
  persGuarantee: string;
  collSecurity: string;
  majorCovenants: string;
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

const LenderTermLoanForm = ({ applId, excelData, openSectionsData }: Props) => {
  const { data: appDetails } = useGetBriefApplDetailsDataQuery(applId as any, { skip: !applId, refetchOnMountOrArgChange: true });
  const [addLimitTlDetails] = useSaveLenderTermLoanFormDataMutation();
  const [deleteLimitTlDetails] = useDeleteLenderTermLoanByIdMutation();
  const { data: LimitTlData, isLoading, isError, refetch } = useGetLenderTermLoanFormDataQuery(applId, { skip: !applId, refetchOnMountOrArgChange: true });

  const [index, setIndex] = useState(0);
  const [initialValues, setInitialValues] = useState<FormValues>({ data: [] });
  const [openConfirmation, setOpenConfirmation] = useState(false);
  const [formData, setFormData] = useState<LenderRow[] | null>(null);
  const [actionVal, setActionVal] = useState<string | null>(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [severity, setSeverity] = useState<"success" | "error">("success");
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackSeverity, setSnackSeverity] = useState<"error" | "success" | "info">("error");
  const [snackMessages, setSnackMessages] = useState<string[]>([]);


  const columnWidths = [60, 60, 250, 150, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 350, 350, 350, 350];

  const formatDate = (str: string | null): string => {
    if (!str) return "";
    if (typeof str === "string") return str;
    const date = new Date(str);
    const mnth = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return [day, mnth, date.getFullYear()].join("-");
  };

  useEffect(() => {
    if (LimitTlData) {
      const dataWithApplId: LenderRow[] = LimitTlData.map((item: any) => ({ ...item, applId }));
      setInitialValues({ data: dataWithApplId });
    }
  }, [LimitTlData, applId]);

  useEffect(() => {
    if (excelData && excelData.length > 0) {
      setIsProcessing(true);
      const lenderRows = excelData.filter((row: any, idx: number) => idx !== 0 && row[2] !== 'Total');
      const newData: LenderRow[] = lenderRows.map((excelRow: any) => ({
        lenderName: excelRow[2]?.toString().trim() || "",
        lenderType: excelRow[3]?.toString().trim() || null,
        sancDt: formatDate(excelRow[4]),
        sancAmt: parseExcelValue(excelRow[5]),
        disbDt: formatDate(excelRow[6]),
        disbAmt: parseExcelValue(excelRow[7]),
        undrawnSanc: parseExcelValue(excelRow[8]),
        outstandingAmt: parseExcelValue(excelRow[9]),
        totalExposure: calculateTotalExposure(parseExcelValue(excelRow[8]), parseExcelValue(excelRow[9])),
        intRate: parseExcelValue(excelRow[11]),
        tenure: parseExcelValue(excelRow[12]),
        contactDetails: excelRow[13]?.toString().trim() || null,
        acr: parseExcelValue(excelRow[14]),
        security: excelRow[15]?.toString().trim() || "",
        corpGuarantee: excelRow[16]?.toString().trim() || "",
        persGuarantee: excelRow[17]?.toString().trim() || "",
        collSecurity: excelRow[18]?.toString().trim() || "",
        majorCovenants: excelRow[19]?.toString().trim() || "",
        slNo: null,
        saveStatus: '01',
        applId,
      }));
      setTimeout(() => {
        setInitialValues({ data: newData });
        setIsProcessing(false);
        setOpenSnackbar(true);
        setSeverity("success");
        setSnackMsg("Lender data imported successfully");
      }, 0);
    }
  }, [excelData, applId]);

  const parseExcelValue = (value: any): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'string') return parseFloat(value.replace(/,/g, '')) || 0;
    return parseFloat(value) || 0;
  };

  const extractErrorMessages = (errorResponse: Record<string, string>): string[] => {
    return Object.values(errorResponse).flatMap(msg => msg.split(',').map(m => m.trim()));
  };

  const handleSubmitApis = async (values: FormValues | LenderRow[]) => {
    try {
      const requestBody = Array.isArray(values) ? values : values.data;
      setIsUploading(true);
      if (await addLimitTlDetails(requestBody).unwrap()) {
        setIsUploading(false);
        setOpenSnackbar(true);
        setSeverity("success");
        setSnackMsg(requestBody[0]?.saveStatus === '02' ? "Section submitted successfully" : "Record saved successfully");
        setActionVal(null);
        return true;
      }
      return false;
    } catch (err: any) {
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

  const handleDelete = async (applId: string, index: number) => {
    handleClose();
    try {
      if (await deleteLimitTlDetails({ applId, index }).unwrap()) {
        setOpenSnackbar(true);
        setSeverity("success");
        setSnackMsg("Record Deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      setOpenSnackbar(true);
      setSeverity("error");
      setSnackMsg("Failed to delete");
    }
  };

  const handleClickOpen = (index: number) => {
    setIndex(index);
    setOpen(true);
  };

  const calculateSanTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.sancAmt as any) || 0), 0);
  const calculateDisbTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.disbAmt as any) || 0), 0);
  const calculateUndrawnSanctionTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.undrawnSanc as any) || 0), 0);
  const calculateOutStTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.outstandingAmt as any) || 0), 0);
  const calculateExpoTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.totalExposure as any) || 0), 0);

  //appDetails
  //sancDt, sancAmt, undrawnSanc, disbDt, disbAmt, outstandingAmt, totalExposure, intRate, tenure, acr, security, corpGuarantee, persGuarantee, collSecurity, majorCovenants

  //  const termLoanListingSchema = Yup.object().shape({
  //   data: Yup.array().of(
  //     Yup.object().shape({
  //       lenderName: Yup.string().min(3, 'Lender Name must be at least 3 characters').max(255, 'Lender Name cannot exceed 255 characters').required('Required'),
  //       contactDetails: Yup.string().max(100, 'contact Detail cannot exceed 100 characters'),
  //       lenderType: Yup.string().max(255, 'Lender Type cannot exceed 255 characters').required('Required'),
  //       acr: Yup.string().required('Required').matches(/^[0-9.]+$/, 'ACR must be a number').test('positive', 'ACR must be between 0-2', val => val ? Number(val) > 0 && Number(val) <= 2 : false),
  //       sancAmt: Yup.number().required('Required'),
  //       disbAmt: Yup.number().required('Required').test('is-not-greater-than-value1', 'Disbursement Amt. cannot be greater than Sanction Amt.', function (value) {
  //         const { sancAmt } = this.parent;
  //         return value <= sancAmt;
  //       }),
  //     })
  //   ),
  // });

  // Changes on 13/10/2025 
  // If date of disbursement – applicationSubmitDate <=180 days, all fields are to be entered mandatorily




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
    const finalValue = values.data.map((listData, index) => ({
      ...listData,
      applId,
      slNo: index + 1,
      saveStatus: actionVal || '',
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

  const calculateTotalExposure = (outstandingAmt: number | null, undrawnSanc: number | null): number => {
    const outstanding = parseFloat(outstandingAmt?.toString() || '0') || 0;
    const undrawn = parseFloat(undrawnSanc?.toString() || '0') || 0;
    return outstanding + undrawn;
  };

  const handleFieldChange = useCallback((index: number, field: string, value: any, setFieldValue: any, values: FormValues) => {
    setFieldValue(`data.${index}.${field}`, value);
    if (field === 'outstandingAmt' || field === 'undrawnSanc') {
      const currentRow = values.data[index];
      const outstandingAmt = field === 'outstandingAmt' ? value : currentRow.outstandingAmt;
      const undrawnSanc = field === 'undrawnSanc' ? value : currentRow.undrawnSanc;
      const newTotalExposure = calculateTotalExposure(outstandingAmt, undrawnSanc);
      setFieldValue(`data.${index}.totalExposure`, newTotalExposure);
    }
  }, []);

  const handleSnackbarCloseSnack = () => setSnackOpen(false);

  const { data: bankMasterData, isLoading: isBankMasterLoading } = useGetMaterQuery(`refapi/mstr/getBankMasters`);
  const bankOptions = useMemo(() => bankMasterData ? modify("mstr/getBankMasters", bankMasterData) : [], [bankMasterData]);

  const { data: lenderTypeData, isLoading: isLenderTypeLoading } = useGetMaterQuery(`refapi/mstr/getLenderType`);
  const lenderTypeOptions = useMemo(() => lenderTypeData ? modify("mstr/getLenderType", lenderTypeData) : [], [lenderTypeData]);

  // const handleDisbDateChange = (newDate: Date | null, index: number, setFieldValue: (field: string, value: any) => void) => {
  //   // console.log(index, 'index', 'field value =>', `data[${index}].disbDt`);
  //   console.log('newDate', newDate);
  // }
  const handleDisbDateChange = (
    date: Date | null,
    index: number,
    setFieldValue: any,
    validateForm: any
  ) => {
    if (!date) return;

    const formatted = format(date, 'dd-MM-yyyy');
    setFieldValue(`data.${index}.disbDt`, [formatted]); // store array format

    // ✅ Trigger full revalidation after date change
    setTimeout(() => validateForm(), 0);
  };

  // Utility: safely parse the API date (handles multiple formats)
  const parseAppSubmitDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;

    // Try parsing with expected format
    let parsed = parse(dateStr, 'yyyy-MM-dd HH:mm:ss.S', new Date());
    if (!isValid(parsed)) {
      // Try fallback format (in case backend returns slightly different)
      parsed = parse(dateStr, 'yyyy-MM-dd HH:mm:ss', new Date());
    }
    if (!isValid(parsed)) {
      // Try final fallback
      parsed = new Date(dateStr);
    }

    return isValid(parsed) ? parsed : null;
  };

  const appSubmitDt: any = parseAppSubmitDate(appDetails?.submitDate);
  console.log('appSubmitDt', appSubmitDt);

  // Helper: check if disbDt - submitDate <= 180
const isWithin180Days = (disbDtArray: any | string, submitDateStr?: any): boolean => {
  try {
    if (!disbDtArray || !submitDateStr) return false;

    const disbStr = Array.isArray(disbDtArray) ? disbDtArray[0] : disbDtArray;
    if (!disbStr) return false;

    // Try multiple formats for flexibility
    const disbDate = parse(disbStr, 'dd-MM-yyyy', new Date());
    const cleanSubmitDate = submitDateStr?.split('.')[0] || submitDateStr;
    const submitDate = parse(cleanSubmitDate, 'yyyy-MM-dd HH:mm:ss', new Date());

    if (!isValid(disbDate) || !isValid(submitDate)) return false;

    const diff = differenceInDays(disbDate, submitDate);
    console.log('diff', diff);
    return diff <= 180;
  } catch (err) {
    console.error('isWithin180Days error:', err);
    return false;
  }
};

  // ✅ Term Loan Schema
  const termLoanListingSchema = (appSubmitDtStr: string) =>
    Yup.object().shape({
      data: Yup.array().of(
        Yup.object().shape({
          // Always required
          lenderName: Yup.string()
            .min(3, 'Lender Name must be at least 3 characters')
            .max(255, 'Lender Name cannot exceed 255 characters')
            .required('Required'),
          lenderType: Yup.string()
            .max(255, 'Lender Type cannot exceed 255 characters')
            .required('Required'),
          acr: Yup.string()
            .required('Required')
            .matches(/^[0-9.]+$/, 'ACR must be a number')
            .test('positive', 'ACR must be between 0-2', val =>
              val ? Number(val) > 0 && Number(val) <= 2 : false
            ),
          sancAmt: Yup.number().required('Required'),
          disbAmt: Yup.number()
            .required('Required')
            .test(
              'is-not-greater-than-value1',
              'Disbursement Amt. cannot be greater than Sanction Amt.',
              function (value) {
                const { sancAmt } = this.parent;
                return value <= sancAmt;
              }
            ),

          // Conditionally required only if disbDt - submitDate <= 180
          sancDt: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Sanction Date is required')
              : schema.notRequired()
          ),
          undrawnSanc: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Undrawn Sanction is required')
              : schema.notRequired()
          ),
          outstandingAmt: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Outstanding Amount is required')
              : schema.notRequired()
          ),
          totalExposure: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Total Exposure is required')
              : schema.notRequired()
          ),
          intRate: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Interest Rate is required')
              : schema.notRequired()
          ),
          tenure: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Tenure is required')
              : schema.notRequired()
          ),
          contactDetails: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Contact Detail is required')
              : schema.notRequired()
          ),
          security: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Security is required')
              : schema.notRequired()
          ),
          corpGuarantee: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Corporate Guarantee is required')
              : schema.notRequired()
          ),
          persGuarantee: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Personal Guarantee is required')
              : schema.notRequired()
          ),
          collSecurity: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Collateral Security is required')
              : schema.notRequired()
          ),
          majorCovenants: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Major Covenants are required')
              : schema.notRequired()
          ),
        })
      ),
    });



  const renderRow = ({ index, style, data }: { index: number; style: any; data: { values: FormValues; setFieldValue: any, validateForm: any, validateField: any } }) => {
    const { values, setFieldValue, validateForm, validateField } = data;
    const row = values.data[index];
    return (
      <div style={{ ...style, display: 'flex' }} className="div-table-row">
        {columnWidths.map((width, colIndex) => (
          <div key={colIndex} style={{ width: `${width}px`, flexShrink: 0, padding: '8px' }} className="div-table-cell">
            {colIndex === 0 && (
              <IconButton className="text-danger" disabled={row.saveStatus === '02'} onClick={() => row.slNo ? handleClickOpen(row.slNo) : values.data.splice(index, 1)}>
                <Delete />
              </IconButton>
            )}
            {colIndex === 1 && <p>{index + 1}</p>}
            {colIndex === 2 && (
              <MultipleLenderDropDown
                label=""
                name={`data.${index}.lenderName`}
                domain=""
                disabled={row.saveStatus === '02'}
                options={bankOptions}
                isLoading={isBankMasterLoading}
              />
            )}
            {colIndex === 3 && (
              <EnhancedDropDown
                label=""
                name={`data.${index}.lenderType`}
                disabled={row.saveStatus === '02'}
                customOptions={lenderTypeOptions}
                domain=""
              />
            )}
            {colIndex === 4 && (
              <AdvanceDatePickerField
                label=""
                name={`data.${index}.sancDt`}
                disableFuture={true}

              />
            )}


            {colIndex === 5 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.sancAmt`}
                type="number"
                onCustomChange={(value: any) => {
                  handleFieldChange(index, 'sancAmt', value, setFieldValue, values);
                  const disbAmt = values.data[index].disbAmt || 0;
                  setFieldValue(`data.${index}.undrawnSanc`, value - disbAmt);
                }}
              />
            )}
            {colIndex === 6 && (
              <>
                {/* <AdvanceDatePickerField
                  label=""
                  name={`data.${index}.disbDt`}
                  disableFuture={true}
                  onChange={date => {
                    console.log('index', index, 'date', date);
                    handleDisbDateChange(date, index, setFieldValue)
                  }}
                  onDateChange={date => {
                    console.log('index', index, 'date', date);
                    handleDisbDateChange(date, index, setFieldValue)
                  }}
                /> */}

                <AdvanceDatePickerField
                  key={index}
                  label=""
                  name={`data.${index}.disbDt`}
                  disableFuture={true}
                  onChange={(date) => {
                    //handleDisbDateChange(date, index, setFieldValue, validateForm)
                    const formatted = date
                      ? `${date.getDate().toString().padStart(2, '0')}-${(
                        date.getMonth() + 1
                      )
                        .toString()
                        .padStart(2, '0')}-${date.getFullYear()}`
                      : '';
                    console.log('formatted', formatted);
                    // setFieldValue(`data.${index}.disbDt`, [formatted]);
                    // validate only conditional fields for this row
                    validateField(`data.${index}.sancDt`);
                    validateField(`data.${index}.undrawnSanc`);
                    validateField(`data.${index}.outstandingAmt`);
                    validateField(`data.${index}.totalExposure`);
                    validateField(`data.${index}.intRate`);
                    validateField(`data.${index}.tenure`);
                    validateField(`data.${index}.contactDetails`);
                    validateField(`data.${index}.security`);
                    validateField(`data.${index}.corpGuarantee`);
                    validateField(`data.${index}.persGuarantee`);
                    validateField(`data.${index}.collSecurity`);
                    validateField(`data.${index}.majorCovenants`);
                  }
                  }
                  onDateChange={(date) => {
                    //handleDisbDateChange(date, index, setFieldValue, validateForm)
                    const formatted = date
                      ? `${date.getDate().toString().padStart(2, '0')}-${(
                        date.getMonth() + 1
                      )
                        .toString()
                        .padStart(2, '0')}-${date.getFullYear()}`
                      : '';
                    console.log('formatted', formatted);
                    // setFieldValue(`data.${index}.disbDt`, [formatted]);
                    // validate only conditional fields for this row
                    validateField(`data.${index}.sancDt`);
                    validateField(`data.${index}.undrawnSanc`);
                    validateField(`data.${index}.outstandingAmt`);
                    validateField(`data.${index}.totalExposure`);
                    validateField(`data.${index}.intRate`);
                    validateField(`data.${index}.tenure`);
                    validateField(`data.${index}.contactDetails`);
                    validateField(`data.${index}.security`);
                    validateField(`data.${index}.corpGuarantee`);
                    validateField(`data.${index}.persGuarantee`);
                    validateField(`data.${index}.collSecurity`);
                    validateField(`data.${index}.majorCovenants`);

                  }
                  }
                />
              </>
            )}

            {colIndex === 7 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.disbAmt`}
                type="number"
                onCustomChange={(value: any) => {
                  handleFieldChange(index, 'disbAmt', value, setFieldValue, values);
                  const sancAmt = values.data[index].sancAmt || 0;
                  setFieldValue(`data.${index}.undrawnSanc`, sancAmt - value);
                }}
              />
            )}
            {colIndex === 8 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.undrawnSanc`}
                disabled={true}
                type="number"
              />
            )}
            {colIndex === 9 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.outstandingAmt`}
                type="number"
                onCustomChange={(value: any) => handleFieldChange(index, 'outstandingAmt', value, setFieldValue, values)}
              />
            )}
            {colIndex === 10 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.totalExposure`}
                type="number"
                disabled={true}
              />
            )}
            {colIndex === 11 && (
              <TextBoxField
                label=""
                name={`data.${index}.intRate`}
                type="number"
              />
            )}
            {colIndex === 12 && (
              <TextBoxField
                label=""
                name={`data.${index}.tenure`}
                type="number"
              />
            )}
            {colIndex === 13 && (
              <TextBoxField
                label=""
                name={`data.${index}.contactDetails`}
              />
            )}
            {colIndex === 14 && (
              <TextBoxField
                label=""
                name={`data.${index}.acr`}
                type="number"
              />
            )}
            {colIndex === 15 && (
              <TextBoxField
                label=""
                name={`data.${index}.security`}
              />
            )}
            {colIndex === 16 && (
              <TextBoxField
                label=""
                name={`data.${index}.corpGuarantee`}
              />
            )}
            {colIndex === 17 && (
              <TextBoxField
                label=""
                name={`data.${index}.persGuarantee`}
              />
            )}
            {colIndex === 18 && (
              <TextBoxField
                label=""
                name={`data.${index}.collSecurity`}
              />
            )}
            {colIndex === 19 && (
              <TextBoxField
                label=""
                name={`data.${index}.majorCovenants`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const [updateCommentByNId] = useUpdateCommentByNIdMutation();
  const [getOpenSectionsData, setOpenSections] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(false);
  const [getNotiId, setNotiId] = useState<any>('');
  const { opensections } = useAppSelector((state: any) => state.userStore);
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

  if (isLoading || isProcessing) return <FormLoader />;
  if (isUploading) return <FullScreenLoaderNoClose />;

  return (
    <>
      <Grid item xs={12} className="opensections-sticky-css">
        <Grid
          className="pb-0"
          item
          xs={12}
          display="flex"
          justifyContent="end">
          {getOpenSectionsData && getOpenSectionsData.length > 0 && (() => {
            const matchedItem = getOpenSectionsData.find(
              (item: any) => item?.sectionId === "09" && item?.subSectionId === "02"
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
              {snackMessages.map((msg, i) => (
                <li key={i} className="text-danger">{`(${i + 1}) ${msg}`}</li>
              ))}
            </ul>
          </Alert>
        </Snackbar>

        <ConfirmationAlertDialog
          id={1}
          type={4}
          open={openConfirmation}
          handleClose={handleCloseConfirmation}
          handleDelete={handleSubmitConfirmation}
          values={formData}
        />
        <div className="custome-form">
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
              validationSchema={termLoanListingSchema(appDetails?.submitDate)}
              // context={{ appSubmitDt: appDetails?.submitDate }}
              validateOnChange={true}
              validateOnBlur={true}
            >
              {({ values, errors, setFieldValue, validateForm, validateField }) => {


                const sanTotal = useMemo(() => calculateSanTotal(values), [values]);
                const disbTotal = useMemo(() => calculateDisbTotal(values), [values]);
                const undrawnTotal = useMemo(() => calculateUndrawnSanctionTotal(values), [values]);
                const outStTotal = useMemo(() => calculateOutStTotal(values), [values]);
                const expoTotal = useMemo(() => calculateExpoTotal(values), [values]);
                const itemCount = values.data.length;
                const ITEM_SIZE = 50;
                const MAX_HEIGHT = 500; // You can adjust this based on your layout
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
                                    applId,
                                    slNo: values.data.length,
                                    lenderName: '',
                                    lenderType: null,
                                    sancDt: null,
                                    sancAmt: null,
                                    disbDt: null,
                                    disbAmt: null,
                                    undrawnSanc: null,
                                    outstandingAmt: null,
                                    totalExposure: null,
                                    intRate: null,
                                    tenure: null,
                                    contactDetails: null,
                                    acr: null,
                                    security: '',
                                    corpGuarantee: '',
                                    persGuarantee: '',
                                    collSecurity: '',
                                    majorCovenants: '',
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
                                    {i === 3 && <b>Institution Type</b>}
                                    {i === 4 && <b>Date of Sanction</b>}
                                    {i === 5 && <b>Sanctioned Amount (In ₹ crore)</b>}
                                    {i === 6 && <b>Date of Disbursement</b>}
                                    {i === 7 && <b>Amount Disbursement (In ₹ crore)</b>}
                                    {i === 8 && <b>Undrawn Sanction</b>}
                                    {i === 9 && <b>Amount Outstanding (In ₹ crore)</b>}
                                    {i === 10 && <b>Total Exposure</b>}
                                    {i === 11 && <b>Interest rate (%)</b>}
                                    {i === 12 && <b>Tenure(in months)</b>}
                                    {i === 13 && <b>Contact Details of Lenders</b>}
                                    {i === 14 && <b>ACR</b>}
                                    {i === 15 && <b>Security</b>}
                                    {i === 16 && <b>Any Corporate Guarantee given for others</b>}
                                    {i === 17 && <b>Any personal guarantee of promoters / founders / directors given to others</b>}
                                    {i === 18 && <b>Any collateral security provided to any lender</b>}
                                    {i === 19 && <b>Major Covenants</b>}
                                  </div>
                                ))}
                              </div>
                              {values.data.length > 0 ? <div style={{ flex: 1 }}>
                                <FixedSizeList
                                  className="table-list-container"
                                  //height={300}
                                  height={calculatedHeight}
                                  itemCount={values.data.length}
                                  itemSize={ITEM_SIZE}
                                  width="100%"
                                  itemData={{ values, setFieldValue, validateForm, validateField }}
                                >
                                  {renderRow}
                                </FixedSizeList> </div> : ''}

                              <div style={{ display: 'flex' }} className="div-table-row">
                                <div style={{ width: `${columnWidths[0]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[1]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[2]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[3]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[4]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell"><b>Total</b></div>
                                <div style={{ width: `${columnWidths[5]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{sanTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths[6]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[7]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{disbTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths[8]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{undrawnTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths[9]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{outStTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths[10]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{expoTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths.slice(11).reduce((a, b) => a + b, 0)}px`, flexShrink: 0 }} className="div-table-cell"></div>
                              </div>
                            </div>
                          </>
                        )}
                      </FieldArray>
                    </fieldset>
                    {values?.data?.[0]?.saveStatus !== "02" && (
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
                    )}
                  </Form>
                );
              }}
            </Formik>
          </div>
          <OnlineSnackbar open={openSnackbar} msg={snackMsg} severity={severity} handleSnackClose={handleClosePop} />
        </div>
      </div>
    </>
  );
};

export default connect((state: any) => ({
  applId: state.userStore.applId
}))(LenderTermLoanForm);
