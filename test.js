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
import { AdvanceTextBoxField } from "../../../components/framework/AdvanceTextBoxField";

interface LenderRow {
    lenderName: string;
    limitType: string;
    sanctionedLimit: number | null;
    totalExposure: number | null;
    latestIntRate: number | null;
    contactDetails: string;
    ncdOs: number | null;
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

    const columnWidths = [60, 60, 150, 250, 170, 170, 170, 170, 320, 120];

    useEffect(() => {
        if (LimitData) {
            const dataWithApplId: LenderRow[] = LimitData.map((item: any) => ({
                ...item,
                applId,
                ncdOs: item.ncdOs ? parseFloat(item.ncdOs) : null,
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
                sanctionedLimit: parseExcelValue(excelRow[5]),
                totalExposure: parseExcelValue(excelRow[9]),
                latestIntRate: parseExcelValue(excelRow[11]),
                contactDetails: excelRow[12]?.toString().trim() || "",
                ncdOs: parseExcelValue(excelRow[13]),
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

    const parseExcelValue = (value: any): number | null => {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'string') return parseFloat(value.replace(/,/g, '')) || null;
        return parseFloat(value) || null;
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
            return +total + (+data1.sanctionedLimit || 0);
        }, 0);
    };

    const calculateNcdTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (+data1.ncdOs || 0);
        }, 0);
    };

    const calculatetotalExposureTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return +total + (+data1.totalExposure || 0);
        }, 0);
    };

    const odListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                lenderName: Yup.string().required('Required'),
                limitType: Yup.string().required('Required'),
                ncdOs: Yup.number().test('is-not-greater-than-value3', 'OutstandingAmt <= sancAmt', function (value: any) {
                    const { sanctionedLimit } = this.parent;
                    return value <= sanctionedLimit;
                }),
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
        const filteredBankOptions = selectedLimitType
            ? bankOptions.filter((opt: any) => selectedLimitType.lenderType.includes(opt.tag))
            : [];
        const exposureType = selectedLimitType?.totalExposure;

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
                            <Grid item xs={12}>
                                <EnhancedDropDown
                                    label=""
                                    name={`data.${index}.limitType`}
                                    disabled={row.saveStatus === '02'}
                                    customOptions={limitTypeOptions}
                                    domain=""
                                    onChange={(value) => {
                                        const selected = limitTypeOptions.find((opt: any) => opt.value === value);
                                        if (selected) {
                                            const expType = selected.totalExposure;
                                            const sanLimit = row.sanctionedLimit || null;
                                            const amtOut = row.ncdOs || null;
                                            const totalExp = expType === 'SL' ? sanLimit : amtOut;
                                            setFieldValue(`data.${index}.totalExposure`, totalExp);
                                        } else {
                                            setFieldValue(`data.${index}.totalExposure`, null);
                                        }
                                    }}
                                />
                            </Grid>
                        )}
                        {colIndex === 3 && (
                            <MultipleLenderDropDown
                                label=""
                                name={`data.${index}.lenderName`}
                                domain=""
                                disabled={row.saveStatus === '02'}
                                options={filteredBankOptions}
                                isLoading={isBankMasterLoading}
                            />
                        )}
                        {colIndex === 4 && (
                            <AdvanceTextBoxField
                                name={`data.${index}.sanctionedLimit`}
                                type="number"
                                onCustomChange={(value: string) => {
                                    const numValue = value ? parseFloat(value) : null;
                                    if (exposureType === 'SL') {
                                        setFieldValue(`data.${index}.totalExposure`, (numValue ? numValue : ""));
                                    }
                                }}
                            />
                        )}
                        {colIndex === 5 && (
                            <AdvanceTextBoxField
                                name={`data.${index}.ncdOs`}
                                type="number"
                                onCustomChange={(value: string) => {
                                    const numValue = value ? parseFloat(value) : null;
                                    if (exposureType === 'AO') {
                                        setFieldValue(`data.${index}.totalExposure`, (numValue ? numValue : ""));
                                    }
                                }}
                            />
                        )}
                        {colIndex === 6 && (
                            <AdvanceTextBoxField
                                name={`data.${index}.totalExposure`}
                                type="number"
                                disabled={true}
                            />
                        )}
                        {colIndex === 7 && (
                            <AdvanceTextBoxField
                                name={`data.${index}.latestIntRate`}
                                type="number"
                            />
                        )}
                        {colIndex === 8 && (
                            <AdvanceTextBoxField
                                name={`data.${index}.contactDetails`}
                            />
                        )}
                        {colIndex === 9 && (
                            <AdvanceTextBoxField
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
                                        const exposureTotal = useMemo(() => calculatetotalExposureTotal(values), [values]);
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
                                                                                sanctionedLimit: null,
                                                                                lenderName: '',
                                                                                totalExposure: null,
                                                                                latestIntRate: null,
                                                                                ncdOs: null,
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
                                                                                {i === 2 && <b>Limit Type</b>}
                                                                                {i === 3 && <b>Name of Bank / Lender</b>}
                                                                                {i === 4 && <b>Sanctioned Limit  (In ₹ crore)</b>}
                                                                                {i === 5 && <b>Amount Outstanding (In ₹ crore)</b>}
                                                                                {i === 6 && <b>Total Exposure (In ₹ crore)</b>}
                                                                                {i === 7 && <b>Interest rate (%)</b>}
                                                                                {i === 8 && <b>Contact details of lenders</b>}
                                                                                {i === 9 && <b>Security</b>}
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
                                                                        <div style={{ width: `${columnWidths[3]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell"><b>Total</b></div>
                                                                        <div style={{ width: `${columnWidths[4]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>
                                                                                {sanTotal}
                                                                                {/* {sanTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })} */}

                                                                            </b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[5]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>
                                                                                {ncdTotal}
                                                                                {/* {ncdTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })} */}

                                                                            </b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[6]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>
                                                                                {exposureTotal}
                                                                                {/*
                                                                                {exposureTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })} */}
                                                                            </b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[7]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[8]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[9]}px`, flexShrink: 0 }} className="div-table-cell"></div>
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


