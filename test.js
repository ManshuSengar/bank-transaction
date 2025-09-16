import { useState, useEffect, useRef } from 'react';
import { Table, TableCell, TableHead, TableRow, TableBody, Button, CircularProgress, Grid } from '@mui/material'
import {
    useGetCollectionEfficiencyQuery,
    useSaveCollectionEffciencyMutation
} from "../../../features/application-form/collectionEff";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SaveAsIcon from '@mui/icons-material/SaveAs';

import { connect } from 'react-redux'
import { FieldArray, Form, Formik } from 'formik';
import AutoSave from '../../../components/framework/AutoSave';
import { AdvanceTextBoxField } from '../../../components/framework/AdvanceTextBoxField';
import { OnlineSnackbar } from "../../../components/shared/OnlineSnackbar";
import ConfirmationAlertDialog from '../../../models/application-form/ConfirmationAlertDialog';
import Notification from '../../../components/shared/Notification';
import { useAppSelector } from '../../../app/hooks';
import DrawerResponseComponent from '../../../components/DrawerComponent/DrawerResponseComponent';
import NotificationSectionWiseButton from '../../../components/DrawerComponent/NotificationSectionWiseButton';
import { useUpdateCommentByNIdMutation } from '../../../features/application-form/applicationForm';
import React from 'react';

const CollectionEfficiencyMonths = ({ excelData, openSectionsData }: any) => {
    const { applId } = useAppSelector((state) => state.userStore);
    const [addCollectionEfficiencyMonths] = useSaveCollectionEffciencyMutation();
    const { data: collectionEfficiencyMonths, isLoading, isError, refetch } = useGetCollectionEfficiencyQuery(applId, { skip: !applId, refetchOnMountOrArgChange: true });

    const [initialValues, setInitialValues] = useState<any>({ data: [] })
    const [openConfirmation, setOpenConfirmation] = useState(false);
    const [formData, setFormData] = useState<any>("");
    const [actionVal, setActionVal] = useState<any>("");
    const formikRef = useRef<any>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);


    const handleSubmitApis = async (values: any) => {
        try {
            let requestBody = values.data;
            if (!requestBody) {
                requestBody = values;
            }
            if (await addCollectionEfficiencyMonths(requestBody).unwrap()) {
                if (requestBody?.[0]?.saveStatus === '02' || requestBody?.[0]?.saveStatus === '01') {
                    setOpenSnackbar(true);
                    setSeverity("success");
                    if (requestBody?.[0]?.saveStatus === '02') {
                        setSnackMsg("Section submitted successfully");
                    } else if (requestBody?.[0]?.saveStatus === '01') {
                        setSnackMsg("Record saved successfully");
                    }
                }
                setActionVal(null);
                return true;
            }
            return false;
        } catch (error: any) {
            setOpenSnackbar(true);
            setSeverity("error");
            setSnackMsg("failed to save : " + error?.message);
            return false;
        }
    };

    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<any>("");
    const [severity, setSeverity] = useState<string>("success");

    const handleClose = () => {
        setOpenSnackbar(false);
    };

    const handleCloseConfirmation = () => {
        setActionVal(null);
        setOpenConfirmation(false);
    };

    const handleSubmitConfirmation = (values: any) => {
        setOpenConfirmation(false);
        handleSubmitApis(values);
    };

    const handleSubmit = async (values: any) => {
        const finalValue = values?.data?.slice(0, 36)?.map((listData: any, index: number) => {
            return {
                ...listData, slNo: index + 1, saveStatus: actionVal
            }
        });
        if (actionVal === '02') {
            setFormData(finalValue);
            setOpenConfirmation(true);
        } else {
            handleSubmitApis(finalValue);
        }
        setActionVal(null);
    };

    const handleClickSetAction = (action: any) => {
        setActionVal(action);
    };

    const propagateChanges = (startIndex: number, newOpening: number, setFieldValue: any, values: any) => {
        if (startIndex >= values.data.length) return;

        const openingPrefix = `data.${startIndex}.openingOvrd`;
        setFieldValue(openingPrefix, newOpening.toFixed(2) || 0);

        const currMonDue = +values.data[startIndex].currMonDue;
        const totDemand = +newOpening + currMonDue;
        setFieldValue(`data.${startIndex}.totDemand`, totDemand.toFixed(2) || 0);

        const totColl = +values.data[startIndex].totColl;
        const overall = (totColl / (totDemand || 1)) * 100;
        setFieldValue(`data.${startIndex}.overallCollection`, overall.toFixed(2) || 0);

        const ovrdColl = +values.data[startIndex].ovrdColl;
        const currMonColl = +values.data[startIndex].currMonColl;
        const closing = +newOpening + currMonDue - ovrdColl - currMonColl;
        setFieldValue(`data.${startIndex}.closingOvrd`, closing.toFixed(2) || 0);

        const nextIndex = startIndex + 1;
        propagateChanges(nextIndex, closing, setFieldValue, values);
    }

    const calculation = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        if (currentRowId === 'openingOvrd' || currentRowId === 'currMonDue') {
            calculationTotalDemand(setFieldValue, values, currentIndex, currentVal, currentRowId);
        } else if (currentRowId === 'ovrdColl' || currentRowId === 'currMonColl' || currentRowId === 'prepayAmt') {
            calculationTotalCollection(setFieldValue, values, currentIndex, currentVal, currentRowId);
        }

        calculationClosingOverdue(setFieldValue, values, currentIndex, currentVal, currentRowId);
        calculationCollection(setFieldValue, values, currentIndex, currentVal, currentRowId);
    }

    const calculationTotalDemand = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const openingOvrd = currentRowId === 'openingOvrd' ? currentVal : currentRow.openingOvrd;
        const currMonDue = currentRowId === 'currMonDue' ? currentVal : currentRow.currMonDue;
        const total = (+openingOvrd + +currMonDue);
        const totalPrefix = 'data.' + currentIndex + '.totDemand';
        setFieldValue(`${totalPrefix}`, total.toFixed(2) || 0);

        const ovrdColl = currentRow.ovrdColl;
        const currMonColl = currentRow.currMonColl;
        const collWithoutPrepay = +ovrdColl + +currMonColl;
        const totColl = currentRow.totColl;
        calculationOverAllCollection(setFieldValue, currentIndex, totColl, total);
        calculationTotCollCurrDemEff(setFieldValue, currentIndex, collWithoutPrepay, currMonDue);
    }

    const calculationTotalCollection = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const ovrdColl = currentRowId === 'ovrdColl' ? currentVal : currentRow.ovrdColl;
        const currMonColl = currentRowId === 'currMonColl' ? currentVal : currentRow.currMonColl;
        const prepayAmt = currentRowId === 'prepayAmt' ? currentVal : currentRow.prepayAmt;
        const total = (+ovrdColl + +currMonColl + +prepayAmt);
        const totalPrefix = 'data.' + currentIndex + '.totColl';
        setFieldValue(`${totalPrefix}`, total.toFixed(2) || 0);

        const collWithoutPrepay = +ovrdColl + +currMonColl;
        const totDemand = currentRow.totDemand;
        calculationOverAllCollection(setFieldValue, currentIndex, total, totDemand);
        calculationTotCollCurrDemEff(setFieldValue, currentIndex, collWithoutPrepay, currentRow.currMonDue);
    }

    const calculationClosingOverdue = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const openingOvrd = currentRowId === 'openingOvrd' ? currentVal : currentRow.openingOvrd;
        const currMonDue = currentRowId === 'currMonDue' ? currentVal : currentRow.currMonDue;
        const ovrdColl = currentRowId === 'ovrdColl' ? currentVal : currentRow.ovrdColl;
        const currMonColl = currentRowId === 'currMonColl' ? currentVal : currentRow.currMonColl;
        const b3MinusE3 = (+openingOvrd - +ovrdColl);
        const c3MinusF3 = (+currMonDue - +currMonColl);
        let total = (+b3MinusE3 + +c3MinusF3);

        const totalPrefix = 'data.' + currentIndex + '.closingOvrd';
        setFieldValue(`${totalPrefix}`, total.toFixed(2) || 0);

        const nextIndex = +currentIndex + +1;
        if (nextIndex < values.data.length) {
            propagateChanges(nextIndex, total, setFieldValue, values);
        }
    }

    const calculationCollection = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const currMonColl = currentRowId === 'currMonColl' ? currentVal : currentRow.currMonColl;
        const currMonDue = currentRowId === 'currMonDue' ? currentVal : currentRow.currMonDue;

        const total = (+currMonColl / +(Number(currMonDue) === 0 ? 1 : currMonDue));

        const totalPrefix = 'data.' + currentIndex + '.currentCollection';
        const totalMul100 = +total * 100;
        setFieldValue(`${totalPrefix}`, totalMul100.toFixed(2) || 0);
    }

    const calculationOverAllCollection = (setFieldValue: any, currentIndex: number, totColl: number, totDemand: number) => {
        const total = (+totColl / +(Number(totDemand) === 0 ? 1 : totDemand));
        const totalPrefix = 'data.' + currentIndex + '.overallCollection';
        const totalMul100 = +total * 100;
        setFieldValue(`${totalPrefix}`, totalMul100.toFixed(2) || 0);
    }

    const calculationTotCollCurrDemEff = (setFieldValue: any, currentIndex: number, collWithoutPrepay: number, currMonDue: number) => {
        const total = (+collWithoutPrepay / +(Number(currMonDue) === 0 ? 1 : currMonDue));
        const totalPrefix = 'data.' + currentIndex + '.currentDemand';
        const totalMul100 = +total * 100;
        setFieldValue(`${totalPrefix}`, totalMul100.toFixed(2) || 0);
    }

    const parseExcelValue = (value: any): any => {
        if (value === undefined || value === null || value === '' || value === '#DIV/0!') return 0;
        return parseFloat(value) ? parseFloat(value).toFixed(2) : 0;
    };


    useEffect(() => {
        if (collectionEfficiencyMonths) {
            const dataWithApplId = collectionEfficiencyMonths.map((item: any) => ({
                ...item,
                applId
            }))
            setInitialValues({ data: dataWithApplId })
        }
    }, [collectionEfficiencyMonths, applId])


    useEffect(() => {
        if (
            excelData &&
            excelData.length > 0 &&
            collectionEfficiencyMonths &&
            formikRef.current
        ) {
            try {
                console.log('excelData', excelData)
                const dataRows = excelData.slice(1);

                const dataWithApplId = collectionEfficiencyMonths.map((item: any) => ({
                    ...item,
                    applId,
                }));

                const processedData = dataWithApplId.map((item: any, index: number) => {
                    // setIsUploading(true);
                    const row = dataRows[index] || [];

                    return {
                        ...item,
                        openingOvrd: parseExcelValue(row[1]),
                        currMonDue: parseExcelValue(row[2]),
                        totDemand: parseExcelValue(row[3]),
                        ovrdColl: parseExcelValue(row[4]),
                        currMonColl: parseExcelValue(row[5]),
                        prepayAmt: parseExcelValue(row[6]),
                        totColl: parseExcelValue(row[7]),
                        closingOvrd: parseExcelValue(row[8]),
                        currentCollection: parseExcelValue(row[9]),
                        overallCollection: parseExcelValue(row[10]),
                    };
                });

                processedData.forEach((item: any, index: number) => {
                    const totDemand = +item.openingOvrd + +item.currMonDue;
                    item.totDemand = totDemand.toFixed(2);

                    const totColl = +item.ovrdColl + +item.currMonColl + +item.prepayAmt;
                    item.totColl = totColl.toFixed(2);

                    const closingOvrd =
                        +item.openingOvrd - +item.ovrdColl + (+item.currMonDue - +item.currMonColl);
                    item.closingOvrd = closingOvrd.toFixed(2);

                    if (index < processedData.length - 1) {
                        processedData[index + 1].openingOvrd = closingOvrd.toFixed(2);
                    }

                    const currentCollection =
                        +item.currMonDue !== 0
                            ? ((+item.currMonColl / +item.currMonDue) * 100).toFixed(2)
                            : "0.00";
                    item.currentCollection = currentCollection;

                    const overallCollection =
                        totDemand !== 0 ? ((totColl / totDemand) * 100).toFixed(2) : "0.00";
                    item.overallCollection = overallCollection;

                    const collWithoutPrepay = +item.ovrdColl + +item.currMonColl;
                    const currentDemand =
                        +item.currMonDue !== 0
                            ? ((collWithoutPrepay / +item.currMonDue) * 100).toFixed(2)
                            : "0.00";
                    item.currentDemand = currentDemand;
                });

                console.log('processedData', processedData)
                formikRef.current.setValues({ data: processedData });
                setInitialValues({ data: processedData })
                setOpenSnackbar(true);
                setIsUploading(false);
                setSeverity("success");
                setSnackMsg("Collection Efficiency data updated successfully");
            } catch (error: any) {
                console.error("Error processing Excel data:", error);
                setOpenSnackbar(true);
                setIsUploading(false);
                setSeverity("error");
                setSnackMsg("Failed to process Excel data: " + error.message);
            }
        }
    }, [excelData, collectionEfficiencyMonths, applId]);

    const [updateCommentByNId] = useUpdateCommentByNIdMutation();
    const { opensections } = useAppSelector((state) => state.userStore);
    const [getOpenSectionsData, setOpenSections] = useState<any[]>([]);
    const [open, setOpen] = React.useState<any>(false);
    const [getNotiId, setNotiId] = React.useState<any>('');

    const toggleDrawer = (newOpen: boolean) => () => {
        setOpen(true);
    };
    const handleButtonClick = (notfId: any) => {
        setOpen(true);
        setNotiId(notfId);
    };
    useEffect(() => {
        if (opensections && opensections.length > 0) {
            setOpenSections(opensections);
        }
    }, [opensections]);

    if (isUploading) return <div className="CrclProg"><CircularProgress /></div>;

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
                            (item: any) => item?.sectionId === "16" && item?.subSectionId === "01"
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
                        open={open}
                        toggleDrawer={toggleDrawer}
                        notfId={getNotiId}
                        detailsData={''}
                        postDataTrigger={updateCommentByNId}
                        setOpen={setOpen}
                    />
                </Grid>
            </Grid>
            {collectionEfficiencyMonths === undefined || null ?
                <Notification /> :
                <div className="wrap-appraisal-area">
                    <ConfirmationAlertDialog
                        id={applId as unknown as number}
                        type={4}
                        open={openConfirmation}
                        handleClose={handleCloseConfirmation}
                        handleDelete={handleSubmitConfirmation}
                        values={formData}
                    />
                    <div className="custome-form">
                        <div className="wrap-inner-table" style={{ overflow: 'auto' }}>
                            <Formik
                                initialValues={initialValues}
                                onSubmit={handleSubmit}
                                enableReinitialize
                                innerRef={formikRef}
                            >
                                {({ values, setFieldValue }) => {
                                    return (
                                        <Form>
                                            <fieldset disabled={values?.data?.[0]?.saveStatus === "02"}>
                                                {values?.data?.[0]?.saveStatus !== "02" &&
                                                    <AutoSave handleSubmit={handleSubmit} values={values} debounceMs={10000} autoStyle={true} />
                                                }
                                                <FieldArray name="data">
                                                    {() => (
                                                        <Table sx={{ minWidth: 650 }} aria-label="simple table">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableCell style={{ minWidth: '80px' }}><b>Month</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Opening Overdue (in ₹ crore)</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Current Month Due (in ₹ crore)</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Total Demand (in ₹ crore) </b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Overdue Collection (in ₹ crore) </b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Current Month Collection (in ₹ crore) </b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Prepayments (in ₹ crore)</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Total Collection (in ₹ crore)</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Closing Overdue (in ₹ crore)</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Current Collection Efficiency (Current Collection/ Current Demand) %</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>Overall Collection Efficiency (Total Collection/ Total Demand) %</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>(Current Collection + Overdue Collection)/ (Current Demand) %</b></TableCell>
                                                                </TableRow>

                                                            </TableHead>
                                                            <TableBody>
                                                                {
                                                                    values?.data?.slice(0, 36)?.map((item: any, index: any) => (
                                                                        <TableRow key={index + 1}>
                                                                            <TableCell>
                                                                                <p>{item?.month}</p>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.openingOvrd`}
                                                                                    label=""
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, currentVal, 'openingOvrd')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>

                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.currMonDue`}
                                                                                    label=""
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, currentVal, 'currMonDue')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>

                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.totDemand`}
                                                                                    label=""
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>

                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.ovrdColl`}
                                                                                    label=""
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, currentVal, 'ovrdColl')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                />

                                                                            </TableCell>

                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.currMonColl`}
                                                                                    label=""
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, currentVal, 'currMonColl')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>

                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.prepayAmt`}
                                                                                    label=""
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, currentVal, 'prepayAmt')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.totColl`}
                                                                                    label=""
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.closingOvrd`}
                                                                                    label=""
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.currentCollection`}
                                                                                    label=""
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.overallCollection`}
                                                                                    label=""
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.currentDemand`}
                                                                                    label=""
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                    allowNegative={false}
                                                                                />
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))
                                                                }
                                                            </TableBody>
                                                        </Table>
                                                    )}
                                                </FieldArray>
                                            </fieldset>
                                            {values?.data?.[0]?.saveStatus !== "02" &&
                                                <Button className="sbmtBtn psn_btn mt-3 mb-3 ms-3" type='submit'
                                                    onClick={() => handleClickSetAction('01')}
                                                    variant="contained"> Save <CheckCircleOutlineIcon />
                                                </Button>
                                            }
                                            {values?.data?.[0]?.saveStatus !== "02" &&
                                                <Button className="sbmtBtn sbmtBtn_scn psn_btn mt-3 mb-3 ms-3" type='submit'
                                                    onClick={() => handleClickSetAction('02')}
                                                    variant="contained"> Submit <SaveAsIcon />
                                                </Button>
                                            }
                                        </Form>
                                    )
                                }}
                            </Formik>
                        </div>
                        <OnlineSnackbar open={openSnackbar} msg={snackMsg} severity={severity}
                            handleSnackClose={handleClose} />
                    </div>
                </div>
            }
        </>

    )
}
export default connect((state: any) => {
    return {
        applId: state.userStore.applId
    };
})(CollectionEfficiencyMonths);

import { useState, useEffect, useRef } from "react";
import { FieldArray, Form, Formik } from 'formik';
import AutoSave from '../../../components/framework/AutoSave';
import { Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Grid } from "@mui/material";
import { connect } from 'react-redux';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppSelector } from "../../../app/hooks";
import {
    useGetpFCutsTenurWiseFormDataQuery,
    useSavepFCutsTenurWiseFormDetailsMutation,
    useDeletePfTenureCutseByIdMutation
} from "../../../features/application-form/Portfoliocuts";
import { AdvanceTextBoxField } from "../../../components/framework/AdvanceTextBoxField";
import { OnlineSnackbar } from "../../../components/shared/OnlineSnackbar";
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ConfirmationAlertDialog from "../../../models/application-form/ConfirmationAlertDialog";
import FullScreenLoaderNoClose from "../../../components/common/FullScreenLoaderNoClose";
import * as Yup from 'yup';
import React from "react";
import DrawerResponseComponent from "../../../components/DrawerComponent/DrawerResponseComponent";
import NotificationSectionWiseButton from "../../../components/DrawerComponent/NotificationSectionWiseButton";
import { useUpdateCommentByNIdMutation } from "../../../features/application-form/applicationForm";
import Notification from "../../../components/shared/Notification";

interface TenureWisePortfolioCutsProps {
    excelData: any;
    openSectionsData: any[];
    isValidated: boolean | null; // New prop to track validation state
    applId: string;
}

const TenureWisePortfolioCuts = ({ excelData, openSectionsData, isValidated, applId }: TenureWisePortfolioCutsProps) => {
    const { transactionData } = useAppSelector((state) => state.userStore);
    const [savepFCutsTenurWiseFormDetails] = useSavepFCutsTenurWiseFormDetailsMutation();
    const [deletepfCuts] = useDeletePfTenureCutseByIdMutation();
    const { data: getpFCutsTenurWiseFormData } = useGetpFCutsTenurWiseFormDataQuery(applId, { refetchOnMountOrArgChange: true });
    const [openDeleteConfirmation, setOpenDeleteConfirmation] = useState(false);
    const [deleteIndex, setDeleteIndex] = useState<any>(null);
    const [deleteSlNo, setDeleteSlNo] = useState<number | null>(null);
    const [openSubmitConfirmation, setOpenSubmitConfirmation] = useState<boolean>(false);
    const [formData, setFormData] = useState<any>("");
    const [actionVal, setActionVal] = useState<any>("");
    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<any>("");
    const [severity, setSeverity] = useState<string | any>("success");
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const setFieldValueRef = useRef<any>(null);

    useEffect(() => {
        if (excelData && excelData?.length > 0) {
            const tenureRows = excelData.filter((row: any) => {
                const minValue = row[1];
                return minValue !== undefined &&
                       minValue !== null &&
                       minValue.toString().trim() !== '' &&
                       minValue.toString().trim().toLowerCase() !== 'sub total' &&
                       minValue.toString().trim().toLowerCase() !== 'subtotal';
            });

            const newData: any = [];
            tenureRows.forEach((excelRow: any, rowIndex: number) => {
                try {
                    const minTenure = parseExcelValue(excelRow[1]);
                    const maxTenure = parseExcelValue(excelRow[2]);

                    if (minTenure !== null && maxTenure !== null && !isNaN(minTenure) && !isNaN(maxTenure)) {
                        const qtrDpd0 = parseExcelValue(excelRow[9]);
                        const qtrDpd1To30 = parseExcelValue(excelRow[10]);
                        const qtrDpd31To60 = parseExcelValue(excelRow[11]);
                        const qtrDpd61To90 = parseExcelValue(excelRow[12]);
                        const qtrDpdAbove90 = parseExcelValue(excelRow[13]);
                        const qtrPosFormula = parseExcelValue(excelRow[8]);
                        const qtrPos = Number((qtrDpd0 + qtrDpd1To30 + qtrDpd31To60 + qtrDpd61To90 + qtrDpdAbove90).toFixed(2));

                        if (Math.abs(qtrPos - qtrPosFormula) > 0.01) {
                            console.warn(`Row ${rowIndex}: qtrPos formula mismatch. Calculated: ${qtrPos}, Excel: ${qtrPosFormula}`);
                            setOpenSnackbar(true);
                            setSeverity("warning");
                            setSnackMsg(`Row ${rowIndex + 1}: qtrPos formula mismatch`);
                        }

                        let tloans = 0;
                        let tpos = 0;
                        let tdpd0 = 0, tdpd1To30 = 0, tdpd31To60 = 0, tdpd61To90 = 0, tdpdAbove90 = 0;
                        if (transactionData?.lstAudQ !== 'Not Applicable') {
                            tloans = parseExcelValue(excelRow[14]);
                            tdpd0 = parseExcelValue(excelRow[16]);
                            tdpd1To30 = parseExcelValue(excelRow[17]);
                            tdpd31To60 = parseExcelValue(excelRow[18]);
                            tdpd61To90 = parseExcelValue(excelRow[19]);
                            tdpdAbove90 = parseExcelValue(excelRow[20]);
                            const tposFormula = parseExcelValue(excelRow[15]);
                            tpos = Number((tdpd0 + tdpd1To30 + tdpd31To60 + tdpd61To90 + tdpdAbove90).toFixed(2));

                            if (Math.abs(tpos - tposFormula) > 0.01) {
                                console.warn(`Row ${rowIndex}: tpos formula mismatch. Calculated: ${tpos}, Excel: ${tposFormula}`);
                                setOpenSnackbar(true);
                                setSeverity("warning");
                                setSnackMsg(`Row ${rowIndex + 1}: tpos formula mismatch`);
                            }
                        }

                        const rowData = {
                            minTenureSlab: Number(minTenure.toFixed(0)),
                            maxTenureSlab: Number(maxTenure.toFixed(0)),
                            tminus2Loans: Number(parseExcelValue(excelRow[3]).toFixed(0)),
                            tminus2Pos: Number(parseExcelValue(excelRow[4]).toFixed(2)),
                            tminus1Loans: Number(parseExcelValue(excelRow[5]).toFixed(0)),
                            tminus1Pos: Number(parseExcelValue(excelRow[6]).toFixed(2)),
                            qtrLoans: Number(parseExcelValue(excelRow[7]).toFixed(0)),
                            qtrPos,
                            qtrDpd0: Number(qtrDpd0.toFixed(2)),
                            qtrDpd1To30: Number(qtrDpd1To30.toFixed(2)),
                            qtrDpd31To60: Number(qtrDpd31To60.toFixed(2)),
                            qtrDpd61To90: Number(qtrDpd61To90.toFixed(2)),
                            qtrDpdAbove90: Number(qtrDpdAbove90.toFixed(2)),
                            tloans: Number(tloans.toFixed(0)),
                            tpos,
                            tdpd0: Number(tdpd0.toFixed(2)),
                            tdpd1To30: Number(tdpd1To30.toFixed(2)),
                            tdpd31To60: Number(tdpd31To60.toFixed(2)),
                            tdpd61To90: Number(tdpd61To90.toFixed(2)),
                            tdpdAbove90: Number(tdpdAbove90.toFixed(2)),
                            slNo: null,
                            saveStatus: '01',
                        };

                        const existingIndex = newData.findIndex((row: any) =>
                            row.minTenureSlab === rowData.minTenureSlab &&
                            row.maxTenureSlab === rowData.maxTenureSlab
                        );
                        if (existingIndex !== -1) {
                            newData[existingIndex] = { ...newData[existingIndex], ...rowData };
                        } else {
                            newData.push(rowData);
                        }
                    } else {
                        console.warn(`Skipping row ${rowIndex}: Invalid tenure values (min: ${minTenure}, max: ${maxTenure})`);
                    }
                } catch (error) {
                    console.error(`Error processing row ${rowIndex}:`, error);
                    setOpenSnackbar(true);
                    setSeverity("warning");
                    setSnackMsg(`Warning: Could not process row ${rowIndex + 1} from Excel data`);
                }
            });

            if (newData.length > 0) {
                setFieldValueRef.current("data", newData);
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg(`Tenure-wise data imported successfully (${newData.length} rows)`);
            } else {
                setOpenSnackbar(true);
                setSeverity("warning");
                setSnackMsg("No valid tenure data found in Excel");
            }
        }
    }, [excelData, transactionData]);

    const parseExcelValue = (value: any): number => {
        if (value === undefined || value === null || value === '') {
            return 0;
        }

        let numericValue: number;

        if (typeof value === 'object' && value !== null && 'result' in value) {
            numericValue = parseFloat(value.result) || 0;
        } else if (typeof value === 'string') {
            const cleanedString = value.replace(/,/g, '').trim();
            numericValue = parseFloat(cleanedString) || 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value).replace(/,/g, '')) || 0;
        }

        if (isNaN(numericValue)) {
            console.warn(`Invalid numeric value parsed: ${JSON.stringify(value)} -> returning 0`);
            return 0;
        }

        return numericValue;
    };

    const tenureWiseListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                minTenureSlab: Yup.number().required('Required'),
                maxTenureSlab: Yup.number().required('Required').moreThan(Yup.ref('minTenureSlab'), 'Max must be greater than Min'),
            })
        ),
    });

    const handleSubmitApis = async (finalValue: any) => {
        try {
            setIsUploading(true);
            const response = await savepFCutsTenurWiseFormDetails(finalValue).unwrap();
            if (response) {
                setOpenSnackbar(true);
                setSeverity("success");
                setIsUploading(false);
                const message = finalValue[0]?.saveStatus === '02'
                    ? "Section submitted successfully"
                    : "Record saved successfully";
                setSnackMsg(message);
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Submission error:", error);
            setOpenSnackbar(true);
            setIsUploading(false);
            setSeverity("error");
            setSnackMsg("Failed to save: " + error?.message);
            return false;
        }
    };

    const handleCloseDeleteConfirmation = () => {
        setOpenDeleteConfirmation(false);
        setDeleteIndex(null);
        setDeleteSlNo(null);
    };

    const handleCloseSubmitConfirmation = () => {
        setActionVal(null);
        setOpenSubmitConfirmation(false);
    };

    const handleSubmitConfirmation = (values: any) => {
        let finalValue = values?.map((listData: any, index: number) => {
            return {
                ...listData, applId, slNo: index + 1, saveStatus: '02'
            };
        });
        setOpenSubmitConfirmation(false);
        handleSubmitApis(finalValue);
    };

    const handleSubmit = async (values: any) => {
        if (actionVal === '02') {
            let finalValue = values?.data?.map((listData: any, index: number) => {
                return {
                    ...listData, applId, slNo: index + 1, saveStatus: '02'
                };
            });
            setFormData(finalValue);
            setOpenSubmitConfirmation(true);
        } else {
            let finalValue = values?.data?.map((listData: any, index: number) => {
                return {
                    ...listData, applId, slNo: index + 1, saveStatus: '01'
                };
            });
            handleSubmitApis(finalValue);
        }
    };

    const handleClickSetAction = (action: any) => {
        setActionVal(action);
    };

    const calculation = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        if (currentRowId === 'qtrDpd0' || currentRowId === 'qtrDpd1To30' || currentRowId === 'qtrDpd31To60'
            || currentRowId === 'qtrDpd61To90' || currentRowId === 'qtrDpdAbove90') {
            calculationCurrentFy(setFieldValue, values, currentIndex, currentVal, currentRowId);
        } else if (currentRowId === 'tdpd0' || currentRowId === 'tdpd1To30' || currentRowId === 'tdpd31To60'
            || currentRowId === 'tdpd61To90' || currentRowId === 'tdpdAbove90') {
            calculationCurrentFyQtr(setFieldValue, values, currentIndex, currentVal, currentRowId);
        }
    };

    const calculationCurrentFy = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const qtrDpd0 = parseFloat(currentRowId === 'qtrDpd0' ? currentVal : currentRow.qtrDpd0) || 0;
        const qtrDpd1To30 = parseFloat(currentRowId === 'qtrDpd1To30' ? currentVal : currentRow.qtrDpd1To30) || 0;
        const qtrDpd31To60 = parseFloat(currentRowId === 'qtrDpd31To60' ? currentVal : currentRow.qtrDpd31To60) || 0;
        const qtrDpd61To90 = parseFloat(currentRowId === 'qtrDpd61To90' ? currentVal : currentRow.qtrDpd61To90) || 0;
        const qtrDpdAbove90 = parseFloat(currentRowId === 'qtrDpdAbove90' ? currentVal : currentRow.qtrDpdAbove90) || 0;

        const total = qtrDpd0 + qtrDpd1To30 + qtrDpd31To60 + qtrDpd61To90 + qtrDpdAbove90;
        setFieldValue(`data.${currentIndex}.qtrPos`, Number(total.toFixed(2)));
    };

    const calculationCurrentFyQtr = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const tdpd0 = parseFloat(currentRowId === 'tdpd0' ? currentVal : currentRow.tdpd0) || 0;
        const tdpd1To30 = parseFloat(currentRowId === 'tdpd1To30' ? currentVal : currentRow.tdpd1To30) || 0;
        const tdpd31To60 = parseFloat(currentRowId === 'tdpd31To60' ? currentVal : currentRow.tdpd31To60) || 0;
        const tdpd61To90 = parseFloat(currentRowId === 'tdpd61To90' ? currentVal : currentRow.tdpd61To90) || 0;
        const tdpdAbove90 = parseFloat(currentRowId === 'tdpdAbove90' ? currentVal : currentRow.tdpdAbove90) || 0;

        const total = tdpd0 + tdpd1To30 + tdpd31To60 + tdpd61To90 + tdpdAbove90;
        setFieldValue(`data.${currentIndex}.tpos`, Number(total.toFixed(2)));
    };

    const getRowValue = (values: any, index: number, currentRowId: string) => {
        if (currentRowId === 'tdpd1To30') return values.data[index].tdpd1To30;
        else if (currentRowId === 'tdpd31To60') return values.data[index].tdpd31To60;
        else if (currentRowId === 'tdpd61To90') return values.data[index].tdpd61To90;
        else if (currentRowId === 'tdpdAbove90') return values.data[index].tdpdAbove90;
        else if (currentRowId === "tdpd0") return values.data[index].tdpd0;
        else if (currentRowId === "tminus2Loans") return values.data[index].tminus2Loans;
        else if (currentRowId === "tminus2Pos") return values.data[index].tminus2Pos;
        else if (currentRowId === "tminus1Loans") return values.data[index].tminus1Loans;
        else if (currentRowId === "tminus1Pos") return values.data[index].tminus1Pos;
        else if (currentRowId === "qtrLoans") return values.data[index].qtrLoans;
        else if (currentRowId === "qtrPos") return values.data[index].qtrPos;
        else if (currentRowId === "qtrDpd0") return values.data[index].qtrDpd0;
        else if (currentRowId === "qtrDpd1To30") return values.data[index].qtrDpd1To30;
        else if (currentRowId === "qtrDpd31To60") return values.data[index].qtrDpd31To60;
        else if (currentRowId === "qtrDpd61To90") return values.data[index].qtrDpd61To90;
        else if (currentRowId === "qtrDpdAbove90") return values.data[index].qtrDpdAbove90;
        else if (currentRowId === "tloans") return values.data[index].tloans;
        else if (currentRowId === "tpos") return values.data[index].tpos;
    };

    const handleClickOpenDeleteConfirmation = (item: any, index: number) => {
        setDeleteIndex(index);
        setDeleteSlNo(item?.slNo || null);
        setOpenDeleteConfirmation(true);
    };

    const handleConfirmDelete = async (applId: any, index: number) => {
        handleCloseDeleteConfirmation();
        try {
            if (await deletepfCuts({ applId, index }).unwrap()) {
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg("Record Deleted successfully");
            }
        } catch (error) {
            console.error("Error deleting tenure-wise record:", error);
            setOpenSnackbar(true);
            setSeverity("error");
            setSnackMsg("Failed to delete");
        }
    };

    const calculatetminus2Loans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus2Loans) || 0);
        }, 0) || 0;
    };

    const calculatettminus2Pos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus2Pos) || 0);
        }, 0) || 0;
    };

    const calculatetminus1Loans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus1Loans) || 0);
        }, 0) || 0;
    };

    const calculatetminus1Pos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus1Pos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrLoans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrLoans) || 0);
        }, 0) || 0;
    };

    const calculatetqtrPos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrPos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrDpd0 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd0) || 0);
        }, 0) || 0;
    };

    const calculatetqtrDpd1To30 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd1To30) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrDpd31To60 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd31To60) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrDpd61To90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd61To90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrDpdAbove90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpdAbove90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrtloans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tloans) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrtpos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tpos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqttdpd0 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd0) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdpd1To30 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd1To30) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpd31To60 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd31To60) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpdtdpd61To90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd61To90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpdtdtdpdAbove90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpdAbove90) || 0);
        }, 0) || 0;
    };

    const [updateCommentByNId] = useUpdateCommentByNIdMutation();
    const { opensections } = useAppSelector((state) => state.userStore);
    const [getOpenSectionsData, setOpenSections] = useState<any[]>([]);
    const [getNotiId, setNotiId] = React.useState<any>('');
    const [openDrawer, setOpenDrawer] = React.useState<any>(false);
    const toggleDrawer = (newOpen: boolean) => () => {
        setOpenDrawer(true);
    };
    const handleButtonClick = (notfId: any) => {
        setOpenDrawer(true);
        setNotiId(notfId);
    };
    useEffect(() => {
        if (opensections && opensections.length > 0) {
            setOpenSections(opensections);
        }
    }, [opensections]);

    const adjustSubsequentMins = (setFieldValue: any, values: any, startIndex: number, newMax: any) => {
        let prevMax = parseFloat(newMax);
        if (isNaN(prevMax)) return;
        for (let i = startIndex + 1; i < values.data.length; i++) {
            setFieldValue(`data.${i}.minTenureSlab`, prevMax);
            prevMax = parseFloat(values.data[i].maxTenureSlab);
            if (isNaN(prevMax)) break;
        }
    };

    if (isUploading) return <FullScreenLoaderNoClose />;

    return (
        <div className="wrap-appraisal-area">
            {!transactionData ?
                <Notification /> :
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
                                    (item: any) => item?.sectionId === "06" && item?.subSectionId === "02"
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
                                open={openDrawer}
                                toggleDrawer={toggleDrawer}
                                notfId={getNotiId}
                                detailsData={''}
                                postDataTrigger={updateCommentByNId}
                                setOpen={setOpenDrawer}
                            />
                        </Grid>
                    </Grid>

                    <div className="custome-form">
                        <ConfirmationAlertDialog
                            id={applId as unknown as number}
                            type={4}
                            open={openSubmitConfirmation}
                            handleClose={handleCloseSubmitConfirmation}
                            handleDelete={handleSubmitConfirmation}
                            values={formData}
                        />

                        <ConfirmationAlertDialog
                            id={applId as unknown as number}
                            index={deleteIndex}
                            type={2}
                            open={openDeleteConfirmation}
                            handleClose={handleCloseDeleteConfirmation}
                            handleDelete={handleConfirmDelete}
                        />

                        <div className="wrap-inner-table" style={{ overflow: 'auto' }}>
                            <Formik
                                initialValues={getpFCutsTenurWiseFormData || { data: [] }}
                                onSubmit={handleSubmit}
                                enableReinitialize
                                validationSchema={tenureWiseListingSchema}
                                validateOnChange={true}
                                validateOnBlur={true}
                            >
                                {({ values, setFieldValue }) => {
                                    setFieldValueRef.current = setFieldValue;
                                    return (
                                        <Form>
                                            <fieldset disabled={values?.data?.[0]?.saveStatus === "02"}>
                                                {values?.data?.[0]?.saveStatus !== "02" &&
                                                    <AutoSave handleSubmit={handleSubmit} values={values} debounceMs={30000} autoStyle={true} />
                                                }
                                                <FieldArray name="data">
                                                    {({ remove, push }) => (
                                                        <>
                                                            {values?.data?.[0]?.saveStatus !== "02" && (
                                                                <Button
                                                                    size="small"
                                                                    className='psn_btn text-capitalize my-2 saveBtn'
                                                                    color="primary"
                                                                    style={{ marginLeft: '15px', display: 'block' }}
                                                                    onClick={() => {
                                                                        const lastIndex = values.data.length - 1;
                                                                        let newMin: any = 0;
                                                                        if (lastIndex >= 0) {
                                                                            const lastMax = parseFloat(values.data[lastIndex].maxTenureSlab);
                                                                            if (!isNaN(lastMax)) {
                                                                                newMin = lastMax;
                                                                            }
                                                                        }
                                                                        push({
                                                                            minTenureSlab: newMin,
                                                                            maxTenureSlab: "",
                                                                            tminus2Loans: "",
                                                                            tminus2Pos: "",
                                                                            tminus1Loans: "",
                                                                            tminus1Pos: "",
                                                                            qtrLoans: "",
                                                                            qtrPos: "",
                                                                            qtrDpd0: "",
                                                                            qtrDpd1To30: "",
                                                                            qtrDpd31To60: "",
                                                                            qtrDpd61To90: "",
                                                                            qtrDpdAbove90: "",
                                                                            tloans: "",
                                                                            tpos: "",
                                                                            tdpd0: "",
                                                                            tdpd1To30: "",
                                                                            tdpd31To60: "",
                                                                            tdpd61To90: "",
                                                                            tdpdAbove90: "",
                                                                            slNo: ""
                                                                        });
                                                                    }}
                                                                >
                                                                    Add <AddCircleIcon />
                                                                </Button>
                                                            )}
                                                            <Table sx={{ minWidth: 650 }} aria-label="simple table" className="smTxt">
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell style={{ width: '7%' }} align='center'>
                                                                            {values?.data?.[0]?.saveStatus !== "02" && (
                                                                                <b>Action</b>)}
                                                                        </TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>Tenure</b></TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>FY {transactionData?.lstAudYrTm2}</b></TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>FY {transactionData?.lstAudYrTm1}</b></TableCell>
                                                                        <TableCell colSpan={7} align='center'><b>FY {transactionData?.lstAudYrT}</b></TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell colSpan={7} align='center'><b>{transactionData?.lstAudQ}</b></TableCell>
                                                                        }
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell style={{ minWidth: '100px' }}><b></b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>Min (In months)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>Max (In months)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>{">"}0</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>1-30</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>31-60</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>61-90</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>{">"}90</b></TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>{">"}0</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>1-30</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>31-60</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>61-90</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>{">"}90</b></TableCell>
                                                                        }
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableBody>
                                                                    {values?.data?.map((item: any, index: any) => (
                                                                        <TableRow key={index}>
                                                                            <TableCell align="center">
                                                                                {item?.saveStatus !== "02" && (
                                                                                    index !== 0 ? (
                                                                                        <IconButton
                                                                                            onClick={() =>
                                                                                                item?.slNo
                                                                                                    ? handleClickOpenDeleteConfirmation(item, item?.slNo)
                                                                                                    : remove(index)
                                                                                            }
                                                                                            color="error"
                                                                                        >
                                                                                            <DeleteIcon />
                                                                                        </IconButton>
                                                                                    ) : (
                                                                                        <IconButton disabled>
                                                                                            <DeleteIcon />
                                                                                        </IconButton>
                                                                                    )
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.minTenureSlab`}
                                                                                    disabled={true}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.maxTenureSlab`}
                                                                                    onCustomChange={(currentVal: any) => {
                                                                                        const val = parseFloat(currentVal) || "";
                                                                                        setFieldValue(`data.${index}.maxTenureSlab`, val);
                                                                                        adjustSubsequentMins(setFieldValue, values, index, currentVal);
                                                                                    }}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus2Loans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus2Loans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus2Pos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus2Pos')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus1Loans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus1Loans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus1Pos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus1Pos')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrLoans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrLoans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrPos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrPos')}
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd0`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd0')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd1To30`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd1To30')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd31To60`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd31To60')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd61To90`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd61To90')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpdAbove90`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpdAbove90')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tloans`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tloans')}
                                                                                            type={'number'}
                                                                                            allowNegative={false}
                                                                                            allowDecimal={false}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tpos`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tpos')}
                                                                                            type={'number'}
                                                                                            disabled={true}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd0`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd0')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd1To30`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd1To30')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd31To60`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd31To60')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd61To90`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd61To90')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpdAbove90`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpdAbove90')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                </>
                                                                            }
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                                {values?.data?.length > 0 && (
                                                                    <TableRow>
                                                                        <TableCell><b>Sub Total</b></TableCell>
                                                                        <TableCell><b></b></TableCell>
                                                                        <TableCell><b></b></TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus2Loans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatettminus2Pos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus1Loans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus1Pos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrLoans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrPos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrDpd0(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrDpd1To30(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrDpd31To60(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrqtrDpd61To90(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrqtrDpdAbove90(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtrqtrtloans(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 0,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtrtpos(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqttdpd0(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdpd1To30(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpd31To60(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpdtdpd61To90(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpdtdtdpdAbove90(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                            </>
                                                                        }
                                                                    </TableRow>
                                                                )}
                                                            </Table>
                                                        </>
                                                    )}
                                                </FieldArray>
                                                {values?.data?.[0]?.saveStatus !== "02" &&
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
                                                            disabled={isValidated === false || isValidated === null} 
                                                        >
                                                            Submit <SaveAsIcon />
                                                        </Button>
                                                    </>
                                                }
                                            </fieldset>
                                        </Form>
                                    );
                                }}
                            </Formik>
                        </div>
                        <OnlineSnackbar
                            open={openSnackbar}
                            msg={snackMsg}
                            severity={severity}
                            handleSnackClose={() => setOpenSnackbar(false)}
                        />
                    </div>
                </>}
        </div>
    );
};

export default connect((state: any) => {
    return {
        applId: state.userStore.applId
    };
})(TenureWisePortfolioCuts);


import { useState, useEffect, useRef } from "react";
import { FieldArray, Form, Formik } from 'formik';
import AutoSave from '../../../components/framework/AutoSave';
import { Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Grid } from "@mui/material";
import { connect } from 'react-redux';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppSelector } from "../../../app/hooks";
import {
    useGetPFCutsIntWiseFormDataQuery,
    useSavepFCutsIntWiseFormDetailsMutation,
    useDeletePFCutsIntWiseMutation 
} from "../../../features/application-form/Portfoliocuts";
import { AdvanceTextBoxField } from "../../../components/framework/AdvanceTextBoxField";
import { OnlineSnackbar } from "../../../components/shared/OnlineSnackbar";
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ConfirmationAlertDialog from "../../../models/application-form/ConfirmationAlertDialog";
import FullScreenLoaderNoClose from "../../../components/common/FullScreenLoaderNoClose";
import * as Yup from 'yup';
import React from "react";
import DrawerResponseComponent from "../../../components/DrawerComponent/DrawerResponseComponent";
import NotificationSectionWiseButton from "../../../components/DrawerComponent/NotificationSectionWiseButton";
import { useUpdateCommentByNIdMutation } from "../../../features/application-form/applicationForm";
import Notification from "../../../components/shared/Notification";

const InterestRateWisePortfolioCutsTable = ({ excelData, openSectionsData ,isValidated}: any) => {
    const { applId, transactionData } = useAppSelector((state) => state.userStore);
    const [savepFCutsIntWiseFormDetails] = useSavepFCutsIntWiseFormDetailsMutation();
    const [deletePfIntCuts] = useDeletePFCutsIntWiseMutation();
    const { data: getPFCutsIntWiseFormData } = useGetPFCutsIntWiseFormDataQuery(applId, { refetchOnMountOrArgChange: true });
    const [openDeleteConfirmation, setOpenDeleteConfirmation] = useState(false);
    const [deleteIndex, setDeleteIndex] = useState<any>(null);
    const [deleteSlNo, setDeleteSlNo] = useState<any>(null);
    const [openSubmitConfirmation, setOpenSubmitConfirmation] = useState<boolean>(false);
    const [formData, setFormData] = useState<any>("");
    const [actionVal, setActionVal] = useState<any>("");
    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<any>("");
    const [severity, setSeverity] = useState<string | any>("success");
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const setFieldValueRef = useRef<any>(null);

    useEffect(() => {
        if (excelData && excelData?.length > 0) {
            const rateRows = excelData.filter((row: any) => {
                const minValue = row[1];
                return minValue !== undefined &&
                       minValue !== null &&
                       minValue.toString().trim() !== '' &&
                       minValue.toString().trim().toLowerCase() !== 'sub total' &&
                       minValue.toString().trim().toLowerCase() !== 'subtotal';
            });

            const newData: any = [];
            rateRows.forEach((excelRow: any, rowIndex: number) => {
                try {
                    const minRateType = parseExcelValue(excelRow[1]);  
                    const maxRateType = parseExcelValue(excelRow[2]); 

                    if (minRateType !== null && maxRateType !== null && !isNaN(minRateType) && !isNaN(maxRateType)) {
                        const qtrDpd0 = parseExcelValue(excelRow[9]);
                        const qtrDpd1To30 = parseExcelValue(excelRow[10]);
                        const qtrDpd31To60 = parseExcelValue(excelRow[11]);
                        const qtrDpd61To90 = parseExcelValue(excelRow[12]);
                        const qtrDpdAbove90 = parseExcelValue(excelRow[13]);
                        const qtrPosFormula = parseExcelValue(excelRow[8]); 
                        const qtrPos = Number((qtrDpd0 + qtrDpd1To30 + qtrDpd31To60 + qtrDpd61To90 + qtrDpdAbove90).toFixed(2));

                        if (Math.abs(qtrPos - qtrPosFormula) > 0.01) {
                            console.warn(`Row ${rowIndex}: qtrPos formula mismatch. Calculated: ${qtrPos}, Excel: ${qtrPosFormula}`);
                            setOpenSnackbar(true);
                            setSeverity("warning");
                            setSnackMsg(`Row ${rowIndex + 1}: qtrPos formula mismatch`);
                        }

                        let tloans = 0;
                        let tpos = 0;
                        let tdpd0 = 0, tdpd1To30 = 0, tdpd31To60 = 0, tdpd61To90 = 0, tdpdAbove90 = 0;
                        if (transactionData?.lstAudQ !== 'Not Applicable') {
                            tloans = parseExcelValue(excelRow[14]);
                            tdpd0 = parseExcelValue(excelRow[16]);
                            tdpd1To30 = parseExcelValue(excelRow[17]);
                            tdpd31To60 = parseExcelValue(excelRow[18]);
                            tdpd61To90 = parseExcelValue(excelRow[19]);
                            tdpdAbove90 = parseExcelValue(excelRow[20]);
                            const tposFormula = parseExcelValue(excelRow[15]); 
                            tpos = Number((tdpd0 + tdpd1To30 + tdpd31To60 + tdpd61To90 + tdpdAbove90).toFixed(2));

                            if (Math.abs(tpos - tposFormula) > 0.01) {
                                console.warn(`Row ${rowIndex}: tpos formula mismatch. Calculated: ${tpos}, Excel: ${tposFormula}`);
                                setOpenSnackbar(true);
                                setSeverity("warning");
                                setSnackMsg(`Row ${rowIndex + 1}: tpos formula mismatch`);
                            }
                        }

                        const rowData = {
                            minRateType: Number(minRateType.toFixed(2)),
                            maxRateType: Number(maxRateType.toFixed(2)),
                            tminus2Loans: Number(parseExcelValue(excelRow[3]).toFixed(0)),
                            tminus2Pos: Number(parseExcelValue(excelRow[4]).toFixed(2)),
                            tminus1Loans: Number(parseExcelValue(excelRow[5]).toFixed(0)),
                            tminus1Pos: Number(parseExcelValue(excelRow[6]).toFixed(2)),
                            qtrLoans: Number(parseExcelValue(excelRow[7]).toFixed(0)),
                            qtrPos,
                            qtrDpd0: Number(qtrDpd0.toFixed(2)),
                            qtrDpd1To30: Number(qtrDpd1To30.toFixed(2)),
                            qtrDpd31To60: Number(qtrDpd31To60.toFixed(2)),
                            qtrDpd61To90: Number(qtrDpd61To90.toFixed(2)),
                            qtrDpdAbove90: Number(qtrDpdAbove90.toFixed(2)),
                            tloans: Number(tloans.toFixed(0)),
                            tpos,
                            tdpd0: Number(tdpd0.toFixed(2)),
                            tdpd1To30: Number(tdpd1To30.toFixed(2)),
                            tdpd31To60: Number(tdpd31To60.toFixed(2)),
                            tdpd61To90: Number(tdpd61To90.toFixed(2)),
                            tdpdAbove90: Number(tdpdAbove90.toFixed(2)),
                            slNo: null,
                            saveStatus: '01',
                        };

                        const existingIndex = newData.findIndex((row: any) => 
                            row.minRateType === rowData.minRateType && 
                            row.maxRateType === rowData.maxRateType
                        );
                        if (existingIndex !== -1) {
                            newData[existingIndex] = { ...newData[existingIndex], ...rowData };
                        } else {
                            newData.push(rowData);
                        }
                    } else {
                        console.warn(`Skipping row ${rowIndex}: Invalid rate values (min: ${minRateType}, max: ${maxRateType})`);
                    }
                } catch (error) {
                    console.error(`Error processing row ${rowIndex}:`, error);
                    setOpenSnackbar(true);
                    setSeverity("warning");
                    setSnackMsg(`Warning: Could not process row ${rowIndex + 1} from Excel data`);
                }
            });

            if (newData.length > 0) {
                setFieldValueRef.current("data", newData);
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg(`Interest Rate-wise data imported successfully (${newData.length} rows)`);
            } else {
                setOpenSnackbar(true);
                setSeverity("warning");
                setSnackMsg("No valid interest rate data found in Excel");
            }
        }
    }, [excelData, transactionData]);

    const parseExcelValue = (value: any): number => {
        if (value === undefined || value === null || value === '') {
            return 0;
        }

        let numericValue: number;

        if (typeof value === 'object' && value !== null && 'result' in value) {
            numericValue = parseFloat(value.result) || 0;
        } else if (typeof value === 'string') {
            const cleanedString = value.replace(/,/g, '').trim();
            numericValue = parseFloat(cleanedString) || 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value).replace(/,/g, '')) || 0;
        }

        if (isNaN(numericValue)) {
            console.warn(`Invalid numeric value parsed: ${JSON.stringify(value)} -> returning 0`);
            return 0;
        }

        return numericValue;
    };

    const interestWiseListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                minRateType: Yup.number().required('Required'),
                maxRateType: Yup.number().required('Required').moreThan(Yup.ref('minRateType'), 'Max must be greater than Min'),
            })
        ),
    });

    const handleSubmitApis = async (finalValue: any) => {
        try {
            setIsUploading(true);
            const response = await savepFCutsIntWiseFormDetails(finalValue).unwrap();
            if (response) {
                setOpenSnackbar(true);
                setSeverity("success");
                setIsUploading(false);
                const message = finalValue[0]?.saveStatus === '02'
                    ? "Section submitted successfully"
                    : "Record saved successfully";
                setSnackMsg(message);
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Submission error:", error);
            setOpenSnackbar(true);
            setIsUploading(false);
            setSeverity("error");
            setSnackMsg("Failed to save: " + error?.message);
            return false;
        }
    };

    const handleCloseDeleteConfirmation = () => {
        setOpenDeleteConfirmation(false);
        setDeleteIndex(null);
        setDeleteSlNo(null);
    };

    const handleCloseSubmitConfirmation = () => {
        setActionVal(null);
        setOpenSubmitConfirmation(false);
    };

    const handleSubmitConfirmation = (values: any) => {
        let finalValue = values?.map((listData: any, index: number) => {
            return {
                ...listData, applId, slNo: index + 1, saveStatus: '02'
            };
        });
        setOpenSubmitConfirmation(false);
        handleSubmitApis(finalValue);
    };

    const handleSubmit = async (values: any) => {
        if (actionVal === '02') {
            let finalValue = values?.data?.map((listData: any, index: number) => {
                return {
                    ...listData, applId, slNo: index + 1, saveStatus: '02'
                };
            });
            setFormData(finalValue);
            setOpenSubmitConfirmation(true);
        } else {
            let finalValue = values?.data?.map((listData: any, index: number) => {
                return {
                    ...listData, applId, slNo: index + 1, saveStatus: '01'
                };
            });
            handleSubmitApis(finalValue);
        }
    };

    const handleClickSetAction = (action: any) => {
        setActionVal(action);
    };

    const calculation = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        if (currentRowId === 'qtrDpd0' || currentRowId === 'qtrDpd1To30' || currentRowId === 'qtrDpd31To60'
            || currentRowId === 'qtrDpd61To90' || currentRowId === 'qtrDpdAbove90') {
            calculationCurrentFy(setFieldValue, values, currentIndex, currentVal, currentRowId);
        } else if (currentRowId === 'tdpd0' || currentRowId === 'tdpd1To30' || currentRowId === 'tdpd31To60'
            || currentRowId === 'tdpd61To90' || currentRowId === 'tdpdAbove90') {
            calculationCurrentFyQtr(setFieldValue, values, currentIndex, currentVal, currentRowId);
        }
    };

    const calculationCurrentFy = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const qtrDpd0 = parseFloat(currentRowId === 'qtrDpd0' ? currentVal : currentRow.qtrDpd0) || 0;
        const qtrDpd1To30 = parseFloat(currentRowId === 'qtrDpd1To30' ? currentVal : currentRow.qtrDpd1To30) || 0;
        const qtrDpd31To60 = parseFloat(currentRowId === 'qtrDpd31To60' ? currentVal : currentRow.qtrDpd31To60) || 0;
        const qtrDpd61To90 = parseFloat(currentRowId === 'qtrDpd61To90' ? currentVal : currentRow.qtrDpd61To90) || 0;
        const qtrDpdAbove90 = parseFloat(currentRowId === 'qtrDpdAbove90' ? currentVal : currentRow.qtrDpdAbove90) || 0;

        const total = qtrDpd0 + qtrDpd1To30 + qtrDpd31To60 + qtrDpd61To90 + qtrDpdAbove90;
        setFieldValue(`data.${currentIndex}.qtrPos`, Number(total.toFixed(2)));
    };

    const calculationCurrentFyQtr = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const tdpd0 = parseFloat(currentRowId === 'tdpd0' ? currentVal : currentRow.tdpd0) || 0;
        const tdpd1To30 = parseFloat(currentRowId === 'tdpd1To30' ? currentVal : currentRow.tdpd1To30) || 0;
        const tdpd31To60 = parseFloat(currentRowId === 'tdpd31To60' ? currentVal : currentRow.tdpd31To60) || 0;
        const tdpd61To90 = parseFloat(currentRowId === 'tdpd61To90' ? currentVal : currentRow.tdpd61To90) || 0;
        const tdpdAbove90 = parseFloat(currentRowId === 'tdpdAbove90' ? currentVal : currentRow.tdpdAbove90) || 0;

        const total = tdpd0 + tdpd1To30 + tdpd31To60 + tdpd61To90 + tdpdAbove90;
        setFieldValue(`data.${currentIndex}.tpos`, Number(total.toFixed(2)));
    };

    const getRowValue = (values: any, index: number, currentRowId: string) => {
        if (currentRowId === 'tdpd1To30') return values.data[index].tdpd1To30;
        else if (currentRowId === 'tdpd31To60') return values.data[index].tdpd31To60;
        else if (currentRowId === 'tdpd61To90') return values.data[index].tdpd61To90;
        else if (currentRowId === 'tdpdAbove90') return values.data[index].tdpdAbove90;
        else if (currentRowId === "tdpd0") return values.data[index].tdpd0;
        else if (currentRowId === "tminus2Loans") return values.data[index].tminus2Loans;
        else if (currentRowId === "tminus2Pos") return values.data[index].tminus2Pos;
        else if (currentRowId === "tminus1Loans") return values.data[index].tminus1Loans;
        else if (currentRowId === "tminus1Pos") return values.data[index].tminus1Pos;
        else if (currentRowId === "qtrLoans") return values.data[index].qtrLoans;
        else if (currentRowId === "qtrPos") return values.data[index].qtrPos;
        else if (currentRowId === "qtrDpd0") return values.data[index].qtrDpd0;
        else if (currentRowId === "qtrDpd1To30") return values.data[index].qtrDpd1To30;
        else if (currentRowId === "qtrDpd31To60") return values.data[index].qtrDpd31To60;
        else if (currentRowId === "qtrDpd61To90") return values.data[index].qtrDpd61To90;
        else if (currentRowId === "qtrDpdAbove90") return values.data[index].qtrDpdAbove90;
        else if (currentRowId === "tloans") return values.data[index].tloans;
        else if (currentRowId === "tpos") return values.data[index].tpos;
    };

    const handleClickOpenDeleteConfirmation = (item: any, index: number) => {
        console.log("item ",item?.slNo,index);
        setDeleteIndex(index);
        setDeleteSlNo(item?.slNo || null);
        setOpenDeleteConfirmation(true);
    };

    const handleConfirmDelete = async (applId: any, slNo: number) => {
        handleCloseDeleteConfirmation();
        try {
            if (await deletePfIntCuts({ applId, slNo }).unwrap()) {
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg("Record Deleted successfully");
            }
        } catch (error) {
            console.error("Error deleting interest rate-wise record:", error);
            setOpenSnackbar(true);
            setSeverity("error");
            setSnackMsg("Failed to delete");
        }
    };

    const calculatetminus2Loans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus2Loans) || 0);
        }, 0) || 0;
    };

    const calculatettminus2Pos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus2Pos) || 0);
        }, 0) || 0;
    };

    const calculatetminus1Loans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus1Loans) || 0);
        }, 0) || 0;
    };

    const calculatetminus1Pos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus1Pos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrLoans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrLoans) || 0);
        }, 0) || 0;
    };

    const calculatetqtrPos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrPos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrDpd0 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd0) || 0);
        }, 0) || 0;
    };

    const calculatetqtrDpd1To30 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd1To30) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrDpd31To60 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd31To60) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrDpd61To90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd61To90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrDpdAbove90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpdAbove90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrtloans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tloans) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrtpos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tpos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqttdpd0 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd0) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdpd1To30 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd1To30) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpd31To60 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd31To60) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpdtdpd61To90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd61To90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpdtdtdpdAbove90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpdAbove90) || 0);
        }, 0) || 0;
    };

    const [updateCommentByNId] = useUpdateCommentByNIdMutation();
    const { opensections } = useAppSelector((state) => state.userStore);
    const [getOpenSectionsData, setOpenSections] = useState<any[]>([]);
    const [getNotiId, setNotiId] = React.useState<any>('');
    const [openDrawer, setOpenDrawer] = React.useState<any>(false);
    const toggleDrawer = (newOpen: boolean) => () => {
        setOpenDrawer(true);
    };
    const handleButtonClick = (notfId: any) => {
        setOpenDrawer(true);
        setNotiId(notfId);
    };
    useEffect(() => {
        if (opensections && opensections.length > 0) {
            setOpenSections(opensections);
        }
    }, [opensections]);

    const adjustSubsequentMins = (setFieldValue: any, values: any, startIndex: number, newMax: any) => {
        let prevMax = parseFloat(newMax);
        if (isNaN(prevMax)) return;
        for (let i = startIndex + 1; i < values.data.length; i++) {
            setFieldValue(`data.${i}.minRateType`, prevMax);
            prevMax = parseFloat(values.data[i].maxRateType);
            if (isNaN(prevMax)) break;
        }
    };

    if (isUploading) return <FullScreenLoaderNoClose />;

    return (
        <div className="wrap-appraisal-area">
            {!transactionData ?
                <Notification /> :
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
                                    (item: any) => item?.sectionId === "06" && item?.subSectionId === "03"
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
                                open={openDrawer}
                                toggleDrawer={toggleDrawer}
                                notfId={getNotiId}
                                detailsData={''}
                                postDataTrigger={updateCommentByNId}
                                setOpen={setOpenDrawer}
                            />
                        </Grid>
                    </Grid>

                    <div className="custome-form">
                        <ConfirmationAlertDialog
                            id={applId as unknown as number}
                            type={4}
                            open={openSubmitConfirmation}
                            handleClose={handleCloseSubmitConfirmation}
                            handleDelete={handleSubmitConfirmation}
                            values={formData}
                        />

                        <ConfirmationAlertDialog
                            id={applId as unknown as number}
                            index={deleteSlNo}
                            type={2}
                            open={openDeleteConfirmation}
                            handleClose={handleCloseDeleteConfirmation}
                            handleDelete={handleConfirmDelete}
                        />

                        <div className="wrap-inner-table" style={{ overflow: 'auto' }}>
                            <Formik
                                initialValues={getPFCutsIntWiseFormData || { data: [] }}
                                onSubmit={handleSubmit}
                                enableReinitialize
                                validationSchema={interestWiseListingSchema}
                                validateOnChange={true}
                                validateOnBlur={true}
                            >
                                {({ values, setFieldValue }) => {
                                    setFieldValueRef.current = setFieldValue;
                                    return (
                                        <Form>
                                            <fieldset disabled={values?.data?.[0]?.saveStatus === "02"}>
                                                {values?.data?.[0]?.saveStatus !== "02" &&
                                                    <AutoSave handleSubmit={handleSubmit} values={values} debounceMs={30000} autoStyle={true} />
                                                }
                                                <FieldArray name="data">
                                                    {({ remove, push }) => (
                                                        <>
                                                            {values?.data?.[0]?.saveStatus !== "02" && (
                                                                <Button
                                                                    size="small"
                                                                    className='psn_btn text-capitalize my-2 saveBtn'
                                                                    color="primary"
                                                                    style={{ marginLeft: '15px', display: 'block' }}
                                                                    onClick={() => {
                                                                        const lastIndex = values.data.length - 1;
                                                                        let newMin: any = 0;
                                                                        if (lastIndex >= 0) {
                                                                            const lastMax = parseFloat(values.data[lastIndex].maxRateType);
                                                                            if (!isNaN(lastMax)) {
                                                                                newMin = lastMax;
                                                                            }
                                                                        }
                                                                        push({
                                                                            minRateType: newMin,
                                                                            maxRateType: "",
                                                                            tminus2Loans: "",
                                                                            tminus2Pos: "",
                                                                            tminus1Loans: "",
                                                                            tminus1Pos: "",
                                                                            qtrLoans: "",
                                                                            qtrPos: "",
                                                                            qtrDpd0: "",
                                                                            qtrDpd1To30: "",
                                                                            qtrDpd31To60: "",
                                                                            qtrDpd61To90: "",
                                                                            qtrDpdAbove90: "",
                                                                            tloans: "",
                                                                            tpos: "",
                                                                            tdpd0: "",
                                                                            tdpd1To30: "",
                                                                            tdpd31To60: "",
                                                                            tdpd61To90: "",
                                                                            tdpdAbove90: "",
                                                                            slNo: ""
                                                                        });
                                                                    }}
                                                                >
                                                                    Add <AddCircleIcon />
                                                                </Button>
                                                            )}
                                                            <Table sx={{ minWidth: 650 }} aria-label="simple table" className="smTxt">
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell style={{ width: '7%' }} align='center'>
                                                                            {values?.data?.[0]?.saveStatus !== "02" && (
                                                                                <b>Action</b>)}
                                                                        </TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>Interest Rate</b></TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>FY {transactionData?.lstAudYrTm2}</b></TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>FY {transactionData?.lstAudYrTm1}</b></TableCell>
                                                                        <TableCell colSpan={7} align='center'><b>FY {transactionData?.lstAudYrT}</b></TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell colSpan={7} align='center'><b>{transactionData?.lstAudQ}</b></TableCell>
                                                                        }
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell style={{ minWidth: '100px' }}><b></b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>Min (%)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>Max (%)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>{">"}0</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>1-30</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>31-60</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>61-90</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>{">"}90</b></TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>{">"}0</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>1-30</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>31-60</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>61-90</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>{">"}90</b></TableCell>
                                                                        }
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableBody>
                                                                    {values?.data?.map((item: any, index: any) => (
                                                                        <TableRow key={index}>
                                                                            <TableCell align="center">
                                                                                {item?.saveStatus !== "02" && (
                                                                                    index !== 0 ? (
                                                                                        <IconButton
                                                                                            onClick={() =>
                                                                                                item?.slNo
                                                                                                    ? handleClickOpenDeleteConfirmation(item, index)
                                                                                                    : remove(index)
                                                                                            }
                                                                                            color="error"
                                                                                        >
                                                                                            <DeleteIcon />
                                                                                        </IconButton>
                                                                                    ) : (
                                                                                        <IconButton disabled>
                                                                                            <DeleteIcon />
                                                                                        </IconButton>
                                                                                    )
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.minRateType`}
                                                                                    disabled={true}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={true}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.maxRateType`}
                                                                                    onCustomChange={(currentVal: any) => {
                                                                                        const val = parseFloat(currentVal) || "";
                                                                                        setFieldValue(`data.${index}.maxRateType`, val);
                                                                                        adjustSubsequentMins(setFieldValue, values, index, currentVal);
                                                                                    }}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={true}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus2Loans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus2Loans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus2Pos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus2Pos')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus1Loans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus1Loans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus1Pos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus1Pos')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrLoans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrLoans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrPos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrPos')}
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd0`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd0')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd1To30`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd1To30')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd31To60`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd31To60')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd61To90`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd61To90')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpdAbove90`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpdAbove90')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tloans`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tloans')}
                                                                                            type={'number'}
                                                                                            allowNegative={false}
                                                                                            allowDecimal={false}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tpos`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tpos')}
                                                                                            type={'number'}
                                                                                            disabled={true}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd0`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd0')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd1To30`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd1To30')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd31To60`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd31To60')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd61To90`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd61To90')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpdAbove90`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpdAbove90')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                </>
                                                                            }
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                                {values?.data?.length > 0 && (
                                                                    <TableRow>
                                                                        <TableCell><b>Sub Total</b></TableCell>
                                                                        <TableCell><b></b></TableCell>
                                                                        <TableCell><b></b></TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus2Loans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatettminus2Pos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus1Loans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus1Pos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrLoans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrPos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrDpd0(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrDpd1To30(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrDpd31To60(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrqtrDpd61To90(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrqtrDpdAbove90(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtrqtrtloans(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 0,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtrtpos(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqttdpd0(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdpd1To30(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpd31To60(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpdtdpd61To90(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpdtdtdpdAbove90(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                            </>
                                                                        }
                                                                    </TableRow>
                                                                )}
                                                            </Table>
                                                        </>
                                                    )}
                                                </FieldArray>
                                                {values?.data?.[0]?.saveStatus !== "02" &&
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
                                                            disabled={isValidated === false || isValidated === null}
                                                        >
                                                            Submit <SaveAsIcon />
                                                        </Button>
                                                    </>
                                                }
                                            </fieldset>
                                        </Form>
                                    );
                                }}
                            </Formik>
                        </div>
                        <OnlineSnackbar
                            open={openSnackbar}
                            msg={snackMsg}
                            severity={severity}
                            handleSnackClose={() => setOpenSnackbar(false)}
                        />
                    </div>
                </>}
        </div>
    );
};

export default connect((state: any) => {
    return {
        applId: state.userStore.applId
    };
})(InterestRateWisePortfolioCutsTable);

import { useState, useEffect, useRef } from "react";
import { FieldArray, Form, Formik } from 'formik';
import AutoSave from '../../../components/framework/AutoSave';
import { Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Grid } from "@mui/material";
import { connect } from 'react-redux';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppSelector } from "../../../app/hooks";
import {
    useGetPFCutsAmtWiseFormDataQuery,
    useSavePFCutsAmtWiseFormDetailsMutation,
    useDeletePFCutsAmtWiseMutation
} from "../../../features/application-form/Portfoliocuts";
import { AdvanceTextBoxField } from "../../../components/framework/AdvanceTextBoxField";
import { OnlineSnackbar } from "../../../components/shared/OnlineSnackbar";
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ConfirmationAlertDialog from "../../../models/application-form/ConfirmationAlertDialog";
import FullScreenLoaderNoClose from "../../../components/common/FullScreenLoaderNoClose";
import * as Yup from 'yup';
import React from "react";
import DrawerResponseComponent from "../../../components/DrawerComponent/DrawerResponseComponent";
import NotificationSectionWiseButton from "../../../components/DrawerComponent/NotificationSectionWiseButton";
import { useUpdateCommentByNIdMutation } from "../../../features/application-form/applicationForm";
import Notification from "../../../components/shared/Notification";

const SanctionedAmountWisePortfolioCutsTable = ({ excelData, openSectionsData,isValidated }: any) => {
    const { applId, transactionData } = useAppSelector((state) => state.userStore);
    const [savePFCutsAmtWiseFormDetails] = useSavePFCutsAmtWiseFormDetailsMutation();
    const [deletePfAmtCuts] = useDeletePFCutsAmtWiseMutation();
    const { data: getPFCutsAmtWiseFormData } = useGetPFCutsAmtWiseFormDataQuery(applId, { refetchOnMountOrArgChange: true });
    const [openDeleteConfirmation, setOpenDeleteConfirmation] = useState(false);
    const [deleteIndex, setDeleteIndex] = useState<any>(null);
    const [deleteSlNo, setDeleteSlNo] = useState<any>(null);
    const [openSubmitConfirmation, setOpenSubmitConfirmation] = useState<boolean>(false);
    const [formData, setFormData] = useState<any>("");
    const [actionVal, setActionVal] = useState<any>("");
    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<any>("");
    const [severity, setSeverity] = useState<string | any>("success");
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const setFieldValueRef = useRef<any>(null);

    useEffect(() => {
        if (excelData && excelData?.length > 0) {
            const sanctionRows = excelData.filter((row: any) => {
                const minValue = row[1]; 
                return minValue !== undefined &&
                       minValue !== null &&
                       minValue.toString().trim() !== '' &&
                       minValue.toString().trim().toLowerCase() !== 'sub total' &&
                       minValue.toString().trim().toLowerCase() !== 'subtotal';
            });

            const newData: any = [];
            sanctionRows.forEach((excelRow: any, rowIndex: number) => {
                try {
                    const minAmtSlab = parseExcelValue(excelRow[1]); 
                    const maxAmtSlab = parseExcelValue(excelRow[2]); 

                    if (minAmtSlab !== null && maxAmtSlab !== null && !isNaN(minAmtSlab) && !isNaN(maxAmtSlab)) {
                        const qtrDpd0 = parseExcelValue(excelRow[9]);
                        const qtrDpd1To30 = parseExcelValue(excelRow[10]);
                        const qtrDpd31To60 = parseExcelValue(excelRow[11]);
                        const qtrDpd61To90 = parseExcelValue(excelRow[12]);
                        const qtrDpdAbove90 = parseExcelValue(excelRow[13]);
                        const qtrPosFormula = parseExcelValue(excelRow[8]); 
                        const qtrPos = Number((qtrDpd0 + qtrDpd1To30 + qtrDpd31To60 + qtrDpd61To90 + qtrDpdAbove90).toFixed(2));

                        if (Math.abs(qtrPos - qtrPosFormula) > 0.01) {
                            console.warn(`Row ${rowIndex}: qtrPos formula mismatch. Calculated: ${qtrPos}, Excel: ${qtrPosFormula}`);
                            setOpenSnackbar(true);
                            setSeverity("warning");
                            setSnackMsg(`Row ${rowIndex + 1}: qtrPos formula mismatch`);
                        }

                        let tloans = 0;
                        let tpos = 0;
                        let tdpd0 = 0, tdpd1To30 = 0, tdpd31To60 = 0, tdpd61To90 = 0, tdpdAbove90 = 0;
                        if (transactionData?.lstAudQ !== 'Not Applicable') {
                            tloans = parseExcelValue(excelRow[14]);
                            tdpd0 = parseExcelValue(excelRow[16]);
                            tdpd1To30 = parseExcelValue(excelRow[17]);
                            tdpd31To60 = parseExcelValue(excelRow[18]);
                            tdpd61To90 = parseExcelValue(excelRow[19]);
                            tdpdAbove90 = parseExcelValue(excelRow[20]);
                            const tposFormula = parseExcelValue(excelRow[15]); 
                            tpos = Number((tdpd0 + tdpd1To30 + tdpd31To60 + tdpd61To90 + tdpdAbove90).toFixed(2));

                            if (Math.abs(tpos - tposFormula) > 0.01) {
                                console.warn(`Row ${rowIndex}: tpos formula mismatch. Calculated: ${tpos}, Excel: ${tposFormula}`);
                                setOpenSnackbar(true);
                                setSeverity("warning");
                                setSnackMsg(`Row ${rowIndex + 1}: tpos formula mismatch`);
                            }
                        }

                        const rowData = {
                            minAmtSlab: Number(minAmtSlab.toFixed(2)),
                            maxAmtSlab: Number(maxAmtSlab.toFixed(2)),
                            tminus2Loans: Number(parseExcelValue(excelRow[3]).toFixed(0)),
                            tminus2Pos: Number(parseExcelValue(excelRow[4]).toFixed(2)),
                            tminus1Loans: Number(parseExcelValue(excelRow[5]).toFixed(0)),
                            tminus1Pos: Number(parseExcelValue(excelRow[6]).toFixed(2)),
                            qtrLoans: Number(parseExcelValue(excelRow[7]).toFixed(0)),
                            qtrPos,
                            qtrDpd0: Number(qtrDpd0.toFixed(2)),
                            qtrDpd1To30: Number(qtrDpd1To30.toFixed(2)),
                            qtrDpd31To60: Number(qtrDpd31To60.toFixed(2)),
                            qtrDpd61To90: Number(qtrDpd61To90.toFixed(2)),
                            qtrDpdAbove90: Number(qtrDpdAbove90.toFixed(2)),
                            tloans: Number(tloans.toFixed(0)),
                            tpos,
                            tdpd0: Number(tdpd0.toFixed(2)),
                            tdpd1To30: Number(tdpd1To30.toFixed(2)),
                            tdpd31To60: Number(tdpd31To60.toFixed(2)),
                            tdpd61To90: Number(tdpd61To90.toFixed(2)),
                            tdpdAbove90: Number(tdpdAbove90.toFixed(2)),
                            slNo: null,
                            saveStatus: '01',
                        };

                        const existingIndex = newData.findIndex((row: any) => 
                            row.minAmtSlab === rowData.minAmtSlab && 
                            row.maxAmtSlab === rowData.maxAmtSlab
                        );
                        if (existingIndex !== -1) {
                            newData[existingIndex] = { ...newData[existingIndex], ...rowData };
                        } else {
                            newData.push(rowData);
                        }
                    } else {
                        console.warn(`Skipping row ${rowIndex}: Invalid sanction values (min: ${minAmtSlab}, max: ${maxAmtSlab})`);
                    }
                } catch (error) {
                    console.error(`Error processing row ${rowIndex}:`, error);
                    setOpenSnackbar(true);
                    setSeverity("warning");
                    setSnackMsg(`Warning: Could not process row ${rowIndex + 1} from Excel data`);
                }
            });

            if (newData.length > 0) {
                setFieldValueRef.current("data", newData);
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg(`Sanction-wise data imported successfully (${newData.length} rows)`);
            } else {
                setOpenSnackbar(true);
                setSeverity("warning");
                setSnackMsg("No valid sanction data found in Excel");
            }
        }
    }, [excelData, transactionData]);

    const parseExcelValue = (value: any): number => {
        if (value === undefined || value === null || value === '') {
            return 0;
        }

        let numericValue: number;

        if (typeof value === 'object' && value !== null && 'result' in value) {
            numericValue = parseFloat(value.result) || 0;
        } else if (typeof value === 'string') {
            const cleanedString = value.replace(/,/g, '').trim();
            numericValue = parseFloat(cleanedString) || 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value).replace(/,/g, '')) || 0;
        }

        if (isNaN(numericValue)) {
            console.warn(`Invalid numeric value parsed: ${JSON.stringify(value)} -> returning 0`);
            return 0;
        }

        return numericValue;
    };

    const sanctionWiseListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                minAmtSlab: Yup.number().required('Required'),
                maxAmtSlab: Yup.number().required('Required').moreThan(Yup.ref('minAmtSlab'), 'Max must be greater than Min'),
            })
        ),
    });

    const handleSubmitApis = async (finalValue: any) => {
        try {
            setIsUploading(true);
            const response = await savePFCutsAmtWiseFormDetails(finalValue).unwrap();
            if (response) {
                setOpenSnackbar(true);
                setSeverity("success");
                setIsUploading(false);

                const message = finalValue[0]?.saveStatus === '02'
                    ? "Section submitted successfully"
                    : "Record saved successfully";

                setSnackMsg(message);
                return true;
            }

            return false;
        } catch (error: any) {
            console.error("Submission error:", error);
            setOpenSnackbar(true);
            setIsUploading(false);
            setSeverity("error");
            setSnackMsg("Failed to save: " + error?.message);
            return false;
        }
    };

    const handleCloseDeleteConfirmation = () => {
        setOpenDeleteConfirmation(false);
        setDeleteIndex(null);
        setDeleteSlNo(null);
    };

    const handleCloseSubmitConfirmation = () => {
        setActionVal(null);
        setOpenSubmitConfirmation(false);
    };

    const handleSubmitConfirmation = (values: any) => {
        let finalValue = values?.map((listData: any, index: number) => {
            return {
                ...listData, applId, slNo: index + 1, saveStatus: '02'
            };
        });
        setOpenSubmitConfirmation(false);
        handleSubmitApis(finalValue);
    };

    const handleSubmit = async (values: any) => {

        if (actionVal === '02') {
            let finalValue = values?.data?.map((listData: any, index: number) => {
                return {
                    ...listData, applId, slNo: index + 1, saveStatus: '02'
                };
            });
            setFormData(finalValue);
            setOpenSubmitConfirmation(true);
        } else {
            let finalValue = values?.data?.map((listData: any, index: number) => {
                return {
                    ...listData, applId, slNo: index + 1, saveStatus: '01'
                };
            });
            handleSubmitApis(finalValue);
        }
    };

    const handleClickSetAction = (action: any) => {
        setActionVal(action);
    };

    const calculation = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        if (currentRowId === 'qtrDpd0' || currentRowId === 'qtrDpd1To30' || currentRowId === 'qtrDpd31To60'
            || currentRowId === 'qtrDpd61To90' || currentRowId === 'qtrDpdAbove90') {
            calculationCurrentFy(setFieldValue, values, currentIndex, currentVal, currentRowId);
        } else if (currentRowId === 'tdpd0' || currentRowId === 'tdpd1To30' || currentRowId === 'tdpd31To60'
            || currentRowId === 'tdpd61To90' || currentRowId === 'tdpdAbove90') {
            calculationCurrentFyQtr(setFieldValue, values, currentIndex, currentVal, currentRowId);
        }
    };

    const calculationCurrentFy = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const qtrDpd0 = parseFloat(currentRowId === 'qtrDpd0' ? currentVal : currentRow.qtrDpd0) || 0;
        const qtrDpd1To30 = parseFloat(currentRowId === 'qtrDpd1To30' ? currentVal : currentRow.qtrDpd1To30) || 0;
        const qtrDpd31To60 = parseFloat(currentRowId === 'qtrDpd31To60' ? currentVal : currentRow.qtrDpd31To60) || 0;
        const qtrDpd61To90 = parseFloat(currentRowId === 'qtrDpd61To90' ? currentVal : currentRow.qtrDpd61To90) || 0;
        const qtrDpdAbove90 = parseFloat(currentRowId === 'qtrDpdAbove90' ? currentVal : currentRow.qtrDpdAbove90) || 0;

        const total = qtrDpd0 + qtrDpd1To30 + qtrDpd31To60 + qtrDpd61To90 + qtrDpdAbove90;
        setFieldValue(`data.${currentIndex}.qtrPos`, Number(total.toFixed(2)));
    };

    const calculationCurrentFyQtr = (setFieldValue: any, values: any, currentIndex: number,
        currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const tdpd0 = parseFloat(currentRowId === 'tdpd0' ? currentVal : currentRow.tdpd0) || 0;
        const tdpd1To30 = parseFloat(currentRowId === 'tdpd1To30' ? currentVal : currentRow.tdpd1To30) || 0;
        const tdpd31To60 = parseFloat(currentRowId === 'tdpd31To60' ? currentVal : currentRow.tdpd31To60) || 0;
        const tdpd61To90 = parseFloat(currentRowId === 'tdpd61To90' ? currentVal : currentRow.tdpd61To90) || 0;
        const tdpdAbove90 = parseFloat(currentRowId === 'tdpdAbove90' ? currentVal : currentRow.tdpdAbove90) || 0;

        const total = tdpd0 + tdpd1To30 + tdpd31To60 + tdpd61To90 + tdpdAbove90;
        setFieldValue(`data.${currentIndex}.tpos`, Number(total.toFixed(2)));
    };

    const getRowValue = (values: any, index: number, currentRowId: string) => {
        if (currentRowId === 'tdpd1To30') return values.data[index].tdpd1To30;
        else if (currentRowId === 'tdpd31To60') return values.data[index].tdpd31To60;
        else if (currentRowId === 'tdpd61To90') return values.data[index].tdpd61To90;
        else if (currentRowId === 'tdpdAbove90') return values.data[index].tdpdAbove90;
        else if (currentRowId === "tdpd0") return values.data[index].tdpd0;
        else if (currentRowId === "tminus2Loans") return values.data[index].tminus2Loans;
        else if (currentRowId === "tminus2Pos") return values.data[index].tminus2Pos;
        else if (currentRowId === "tminus1Loans") return values.data[index].tminus1Loans;
        else if (currentRowId === "tminus1Pos") return values.data[index].tminus1Pos;
        else if (currentRowId === "qtrLoans") return values.data[index].qtrLoans;
        else if (currentRowId === "qtrPos") return values.data[index].qtrPos;
        else if (currentRowId === "qtrDpd0") return values.data[index].qtrDpd0;
        else if (currentRowId === "qtrDpd1To30") return values.data[index].qtrDpd1To30;
        else if (currentRowId === "qtrDpd31To60") return values.data[index].qtrDpd31To60;
        else if (currentRowId === "qtrDpd61To90") return values.data[index].qtrDpd61To90;
        else if (currentRowId === "qtrDpdAbove90") return values.data[index].qtrDpdAbove90;
        else if (currentRowId === "tloans") return values.data[index].tloans;
        else if (currentRowId === "tpos") return values.data[index].tpos;
    };

    const handleClickOpenDeleteConfirmation = (item: any, index: number) => {
        console.log("item ",item?.slNo,index);
        setDeleteIndex(index);
        setDeleteSlNo(item?.slNo || null);
        setOpenDeleteConfirmation(true);
    };

    const handleConfirmDelete = async (applId: any, slNo: number) => {
        handleCloseDeleteConfirmation();
        try {
            if (await deletePfAmtCuts({ applId, slNo }).unwrap()) {
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg("Record Deleted successfully");
            }
        } catch (error) {
            console.error("Error deleting sanctioned amount-wise record:", error);
            setOpenSnackbar(true);
            setSeverity("error");
            setSnackMsg("Failed to delete");
        }
    };

    const calculatetminus2Loans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus2Loans) || 0);
        }, 0) || 0;
    };

    const calculatettminus2Pos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus2Pos) || 0);
        }, 0) || 0;
    };

    const calculatetminus1Loans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus1Loans) || 0);
        }, 0) || 0;
    };

    const calculatetminus1Pos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus1Pos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrLoans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrLoans) || 0);
        }, 0) || 0;
    };

    const calculatetqtrPos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrPos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrDpd0 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd0) || 0);
        }, 0) || 0;
    };

    const calculatetqtrDpd1To30 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd1To30) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrDpd31To60 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd31To60) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrDpd61To90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd61To90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrDpdAbove90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpdAbove90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrqtrtloans = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tloans) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtrtpos = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tpos) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqttdpd0 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd0) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdpd1To30 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd1To30) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpd31To60 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd31To60) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpdtdpd61To90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd61To90) || 0);
        }, 0) || 0;
    };

    const calculatetqtrqtdptdpdtdtdpdAbove90 = (values: any) => {
        return values.data?.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpdAbove90) || 0);
        }, 0) || 0;
    };

    const [updateCommentByNId] = useUpdateCommentByNIdMutation();
    const { opensections } = useAppSelector((state) => state.userStore);
    const [getOpenSectionsData, setOpenSections] = useState<any[]>([]);
    const [getNotiId, setNotiId] = React.useState<any>('');
    const [openDrawer, setOpenDrawer] = React.useState<any>(false);
    const toggleDrawer = (newOpen: boolean) => () => {
        setOpenDrawer(true);
    };
    const handleButtonClick = (notfId: any) => {
        setOpenDrawer(true);
        setNotiId(notfId);
    };
    useEffect(() => {
        if (opensections && opensections.length > 0) {
            setOpenSections(opensections);
        }
    }, [opensections]);

    const adjustSubsequentMins = (setFieldValue: any, values: any, startIndex: number, newMax: any) => {
        let prevMax = parseFloat(newMax);
        if (isNaN(prevMax)) return;
        for (let i = startIndex + 1; i < values.data.length; i++) {
            setFieldValue(`data.${i}.minAmtSlab`, prevMax);
            prevMax = parseFloat(values.data[i].maxAmtSlab);
            if (isNaN(prevMax)) break;
        }
    };

    if (isUploading) return <FullScreenLoaderNoClose />;

    return (
        <div className="wrap-appraisal-area">
            {!transactionData ?
                <Notification /> :
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
                                    (item: any) => item?.sectionId === "06" && item?.subSectionId === "04"
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
                                open={openDrawer}
                                toggleDrawer={toggleDrawer}
                                notfId={getNotiId}
                                detailsData={''}
                                postDataTrigger={updateCommentByNId}
                                setOpen={setOpenDrawer}
                            />
                        </Grid>
                    </Grid>

                    <div className="custome-form">
                        <ConfirmationAlertDialog
                            id={applId as unknown as number}
                            type={4}
                            open={openSubmitConfirmation}
                            handleClose={handleCloseSubmitConfirmation}
                            handleDelete={handleSubmitConfirmation}
                            values={formData}
                        />

                        <ConfirmationAlertDialog
                            id={applId as unknown as number}
                            index={deleteSlNo}
                            type={2}
                            open={openDeleteConfirmation}
                            handleClose={handleCloseDeleteConfirmation}
                            handleDelete={handleConfirmDelete}
                        />

                        <div className="wrap-inner-table" style={{ overflow: 'auto' }}>
                            <Formik
                                initialValues={getPFCutsAmtWiseFormData || { data: [] }}
                                onSubmit={handleSubmit}
                                enableReinitialize
                                validationSchema={sanctionWiseListingSchema}
                                validateOnChange={true}
                                validateOnBlur={true}
                            >
                                {({ values, setFieldValue }) => {
                                    setFieldValueRef.current = setFieldValue;
                                    return (
                                        <Form>
                                            <fieldset disabled={values?.data?.[0]?.saveStatus === "02"}>
                                                {values?.data?.[0]?.saveStatus !== "02" &&
                                                    <AutoSave handleSubmit={handleSubmit} values={values} debounceMs={30000} autoStyle={true} />
                                                }
                                                <FieldArray name="data">
                                                    {({ remove, push }) => (
                                                        <>
                                                            {values?.data?.[0]?.saveStatus !== "02" && (
                                                                <Button
                                                                    size="small"
                                                                    className='psn_btn text-capitalize my-2 saveBtn'
                                                                    color="primary"
                                                                    style={{ marginLeft: '15px', display: 'block' }}
                                                                    onClick={() => {
                                                                        const lastIndex = values.data.length - 1;
                                                                        let newMin: any = 0;
                                                                        if (lastIndex >= 0) {
                                                                            const lastMax = parseFloat(values.data[lastIndex].maxAmtSlab);
                                                                            if (!isNaN(lastMax)) {
                                                                                newMin = lastMax;
                                                                            }
                                                                        }
                                                                        push({
                                                                            minAmtSlab: newMin,
                                                                            maxAmtSlab: "",
                                                                            tminus2Loans: "",
                                                                            tminus2Pos: "",
                                                                            tminus1Loans: "",
                                                                            tminus1Pos: "",
                                                                            qtrLoans: "",
                                                                            qtrPos: "",
                                                                            qtrDpd0: "",
                                                                            qtrDpd1To30: "",
                                                                            qtrDpd31To60: "",
                                                                            qtrDpd61To90: "",
                                                                            qtrDpdAbove90: "",
                                                                            tloans: "",
                                                                            tpos: "",
                                                                            tdpd0: "",
                                                                            tdpd1To30: "",
                                                                            tdpd31To60: "",
                                                                            tdpd61To90: "",
                                                                            tdpdAbove90: "",
                                                                            slNo: ""
                                                                        });
                                                                    }}
                                                                >
                                                                    Add <AddCircleIcon />
                                                                </Button>
                                                            )}
                                                            <Table sx={{ minWidth: 650 }} aria-label="simple table" className="smTxt">
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell style={{ width: '7%' }} align='center'>
                                                                            {values?.data?.[0]?.saveStatus !== "02" && (
                                                                                <b>Action</b>)}
                                                                        </TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>Sanction Amount (in ₹ crore)</b></TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>FY {transactionData?.lstAudYrTm2}</b></TableCell>
                                                                        <TableCell colSpan={2} align='center'><b>FY {transactionData?.lstAudYrTm1}</b></TableCell>
                                                                        <TableCell colSpan={7} align='center'><b>FY {transactionData?.lstAudYrT}</b></TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell colSpan={7} align='center'><b>{transactionData?.lstAudQ}</b></TableCell>
                                                                        }
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell style={{ minWidth: '100px' }}><b></b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>Min (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>Max (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>{">"}0</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>1-30</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>31-60</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>61-90</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>{">"}90</b></TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>POS (in ₹ crore)</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>{">"}0</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>1-30</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>31-60</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>61-90</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>{">"}90</b></TableCell>
                                                                        }
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableBody>
                                                                    {values?.data?.map((item: any, index: any) => (
                                                                        <TableRow key={index}>
                                                                            <TableCell align="center">
                                                                                {item?.saveStatus !== "02" && (
                                                                                    index !== 0 ? (
                                                                                        <IconButton
                                                                                            onClick={() =>
                                                                                                item?.slNo
                                                                                                    ? handleClickOpenDeleteConfirmation(item, index)
                                                                                                    : remove(index)
                                                                                            }
                                                                                            color="error"
                                                                                        >
                                                                                            <DeleteIcon />
                                                                                        </IconButton>
                                                                                    ) : (
                                                                                        <IconButton disabled>
                                                                                            <DeleteIcon />
                                                                                        </IconButton>
                                                                                    )
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.minAmtSlab`}
                                                                                    disabled={true}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={true}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.maxAmtSlab`}
                                                                                    onCustomChange={(currentVal: any) => {
                                                                                        const val = parseFloat(currentVal) || "";
                                                                                        setFieldValue(`data.${index}.maxAmtSlab`, val);
                                                                                        adjustSubsequentMins(setFieldValue, values, index, currentVal);
                                                                                    }}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={true}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus2Loans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus2Loans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus2Pos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus2Pos')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus1Loans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus1Loans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus1Pos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tminus1Pos')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrLoans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrLoans')}
                                                                                    type={'number'}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrPos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrPos')}
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd0`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd0')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd1To30`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd1To30')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd31To60`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd31To60')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd61To90`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpd61To90')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpdAbove90`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'qtrDpdAbove90')}
                                                                                    type={'number'}
                                                                                    disabled={item?.saveStatus === '02'}
                                                                                />
                                                                            </TableCell>
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tloans`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tloans')}
                                                                                            type={'number'}
                                                                                            allowNegative={false}
                                                                                            allowDecimal={false}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tpos`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tpos')}
                                                                                            type={'number'}
                                                                                            disabled={true}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd0`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd0')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd1To30`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd1To30')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd31To60`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd31To60')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpd61To90`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd61To90')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <AdvanceTextBoxField
                                                                                            name={`data.${index}.tdpdAbove90`}
                                                                                            onCustomChange={(currentVal: any) =>
                                                                                                calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpdAbove90')}
                                                                                            type={'number'}
                                                                                            disabled={item?.saveStatus === '02'}
                                                                                        />
                                                                                    </TableCell>
                                                                                </>
                                                                            }
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                                {values?.data?.length > 0 && (
                                                                    <TableRow>
                                                                        <TableCell><b>Sub Total</b></TableCell>
                                                                        <TableCell><b></b></TableCell>
                                                                        <TableCell><b></b></TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus2Loans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatettminus2Pos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus1Loans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetminus1Pos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrLoans(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 0,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrPos(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrDpd0(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrDpd1To30(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrDpd31To60(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrqtrDpd61To90(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <b>
                                                                                {calculatetqtrqtrqtrDpdAbove90(values).toLocaleString('en-IN', {
                                                                                    maximumFractionDigits: 2,
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                })}
                                                                            </b>
                                                                        </TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtrqtrtloans(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 0,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtrtpos(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqttdpd0(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdpd1To30(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpd31To60(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpdtdpd61To90(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <b>
                                                                                        {calculatetqtrqtdptdpdtdtdpdAbove90(values).toLocaleString('en-IN', {
                                                                                            maximumFractionDigits: 2,
                                                                                            style: 'currency',
                                                                                            currency: 'INR'
                                                                                        })}
                                                                                    </b>
                                                                                </TableCell>
                                                                            </>
                                                                        }
                                                                    </TableRow>
                                                                )}
                                                            </Table>
                                                        </>
                                                    )}
                                                </FieldArray>
                                                {values?.data?.[0]?.saveStatus !== "02" &&
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
                                                            disabled={isValidated === false || isValidated === null}
                                                        >
                                                            Submit <SaveAsIcon />
                                                        </Button>
                                                    </>
                                                }
                                            </fieldset>
                                        </Form>
                                    );
                                }}
                            </Formik>
                        </div>
                        <OnlineSnackbar
                            open={openSnackbar}
                            msg={snackMsg}
                            severity={severity}
                            handleSnackClose={() => setOpenSnackbar(false)}
                        />
                    </div>
                </>}
        </div>
    );
};

export default connect((state: any) => {
    return {
        applId: state.userStore.applId
    };
})(SanctionedAmountWisePortfolioCutsTable);





