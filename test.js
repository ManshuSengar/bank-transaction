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
    useDeletePfAmtCutsByIdMutation
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

const SanctionedAmountWisePortfolioCutsTable = ({ excelData, openSectionsData }: any) => {
    const { applId, transactionData } = useAppSelector((state) => state.userStore);
    const [savePFCutsAmtWiseFormDetails] = useSavePFCutsAmtWiseFormDetailsMutation();
    const [deletePfAmtCuts] = useDeletePfAmtCutsByIdMutation();
    const { data: getPFCutsAmtWiseFormData } = useGetPFCutsAmtWiseFormDataQuery(applId, { refetchOnMountOrArgChange: true });
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
            const amtRows = excelData.filter((row: any) => row[0] && row[0]?.toString().trim() !== 'Sub Total');
            const newData: any = [];

            amtRows.forEach((excelRow: any) => {
                const amtSlab = excelRow[0]?.toString().trim();
                let minAmtSlab = 0;
                let maxAmtSlab = 0;
                if (amtSlab !== "Sub Total") {
                    if (amtSlab.includes('-')) {
                        const [minStr, maxStr] = amtSlab.split('-').map((s: string) => s.trim());
                        minAmtSlab = parseFloat(minStr) || 0;
                        maxAmtSlab = parseFloat(maxStr) || 0;
                    } else {
                        minAmtSlab = parseFloat(amtSlab) || 0;
                        maxAmtSlab = minAmtSlab;
                    }

                    const qtrDpd0 = parseExcelValue(excelRow[7]);
                    const qtrDpd1To30 = parseExcelValue(excelRow[8]);
                    const qtrDpd31To60 = parseExcelValue(excelRow[9]);
                    const qtrDpd61To90 = parseExcelValue(excelRow[10]);
                    const qtrDpdAbove90 = parseExcelValue(excelRow[11]);
                    const qtrPos = (qtrDpd0 + qtrDpd1To30 + qtrDpd31To60 + qtrDpd61To90 + qtrDpdAbove90).toFixed(2);

                    let tpos = '0';
                    if (transactionData?.lstAudQ !== 'Not Applicable') {
                        const tdpd0 = parseExcelValue(excelRow[14]);
                        const tdpd1To30 = parseExcelValue(excelRow[15]);
                        const tdpd31To60 = parseExcelValue(excelRow[16]);
                        const tdpd61To90 = parseExcelValue(excelRow[17]);
                        const tdpdAbove90 = parseExcelValue(excelRow[18]);
                        tpos = (tdpd0 + tdpd1To30 + tdpd31To60 + tdpd61To90 + tdpdAbove90).toFixed(2);
                    }

                    const rowData = {
                        minAmtSlab,
                        maxAmtSlab,
                        tminus2Loans: parseExcelValue(excelRow[1]),
                        tminus2Pos: parseExcelValue(excelRow[2]),
                        tminus1Loans: parseExcelValue(excelRow[3]),
                        tminus1Pos: parseExcelValue(excelRow[4]),
                        qtrLoans: parseExcelValue(excelRow[5]),
                        qtrPos,
                        qtrDpd0,
                        qtrDpd1To30,
                        qtrDpd31To60,
                        qtrDpd61To90,
                        qtrDpdAbove90,
                        tloans: parseExcelValue(excelRow[12]),
                        tpos,
                        tdpd0: parseExcelValue(excelRow[14]),
                        tdpd1To30: parseExcelValue(excelRow[15]),
                        tdpd31To60: parseExcelValue(excelRow[16]),
                        tdpd61To90: parseExcelValue(excelRow[17]),
                        tdpdAbove90: parseExcelValue(excelRow[18]),
                        slNo: null,
                        saveStatus: '01',
                    };

                    const existingIndex = newData.findIndex((row: any) => row.minAmtSlab === minAmtSlab && row.maxAmtSlab === maxAmtSlab);
                    if (existingIndex !== -1) {
                        newData[existingIndex] = { ...newData[existingIndex], ...rowData };
                    } else {
                        newData.push(rowData);
                    }
                }
            });

            setFieldValueRef.current("data", newData);
            setOpenSnackbar(true);
            setSeverity("success");
            setSnackMsg("Sanctioned Amount-wise data imported successfully");
        }
    }, [excelData, transactionData]);

    const amtWiseListingSchema = Yup.object().shape({
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
        setFieldValue(`data.${currentIndex}.qtrPos`, total.toFixed(2));
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
        setFieldValue(`data.${currentIndex}.tpos`, total.toFixed(2));
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

    const parseExcelValue = (value: any): number => {
        if (value === undefined || value === null || value === '') return 0;
        if (typeof value === 'string') return parseFloat(value.replace(/,/g, '')) || 0;
        return parseFloat(value.toFixed(2)) || 0;
    };

    const calculatetminus2Loans = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus2Loans) || 0);
        }, 0);
    };

    const calculatettminus2Pos = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus2Pos) || 0);
        }, 0);
    };

    const calculatetminus1Loans = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus1Loans) || 0);
        }, 0);
    };

    const calculatetminus1Pos = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tminus1Pos) || 0);
        }, 0);
    };

    const calculatetqtrLoans = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrLoans) || 0);
        }, 0);
    };

    const calculatetqtrPos = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrPos) || 0);
        }, 0);
    };

    const calculatetqtrDpd0 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd0) || 0);
        }, 0);
    };

    const calculatetqtrDpd1To30 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd1To30) || 0);
        }, 0);
    };

    const calculatetqtrqtrDpd31To60 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd31To60) || 0);
        }, 0);
    };

    const calculatetqtrqtrqtrDpd61To90 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpd61To90) || 0);
        }, 0);
    };

    const calculatetqtrqtrqtrDpdAbove90 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.qtrDpdAbove90) || 0);
        }, 0);
    };

    const calculatetqtrqtrqtrtloans = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tloans) || 0);
        }, 0);
    };

    const calculatetqtrqtrtpos = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tpos) || 0);
        }, 0);
    };

    const calculatetqtrqttdpd0 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd0) || 0);
        }, 0);
    };

    const calculatetqtrqtdpd1To30 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd1To30) || 0);
        }, 0);
    };

    const calculatetqtrqtdptdpd31To60 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd31To60) || 0);
        }, 0);
    };

    const calculatetqtrqtdptdpdtdpd61To90 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpd61To90) || 0);
        }, 0);
    };

    const calculatetqtrqtdptdpdtdtdpdAbove90 = (values: any) => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1?.tdpdAbove90) || 0);
        }, 0);
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
                                validationSchema={amtWiseListingSchema}
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
                                                                        <TableCell colSpan={2} align='center'><b>Amount (INR, thousand)</b></TableCell>
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
                                                                        <TableCell style={{ minWidth: '100px' }}><b>Min</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>Max</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>{">"}0</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>1-30</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>31-60</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>61-90</b></TableCell>
                                                                        <TableCell style={{ minWidth: '100px' }}><b>{">"}90</b></TableCell>
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell style={{ minWidth: '100px' }}><b>POS</b></TableCell>
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
                                                                                    allowDecimal={false}
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
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tpos`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tpos')}
                                                                                        type={'number'}
                                                                                        disabled={true}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpd0`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd0')}
                                                                                        type={'number'}
                                                                                        disabled={item?.saveStatus === '02'}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpd1To30`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd1To30')}
                                                                                        type={'number'}
                                                                                        disabled={item?.saveStatus === '02'}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpd31To60`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd31To60')}
                                                                                        type={'number'}
                                                                                        disabled={item?.saveStatus === '02'}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpd61To90`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpd61To90')}
                                                                                        type={'number'}
                                                                                        disabled={item?.saveStatus === '02'}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpdAbove90`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index, parseFloat(currentVal) || 0, 'tdpdAbove90')}
                                                                                        type={'number'}
                                                                                        disabled={item?.saveStatus === '02'}
                                                                                    />
                                                                                </TableCell>
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
                                                                                    maximumFractionDigits: 2,
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
                                                                                    maximumFractionDigits: 2,
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
                                                                                    maximumFractionDigits: 2,
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
                                                                            <TableCell>
                                                                                <b>
                                                                                    {calculatetqtrqtrqtrtloans(values).toLocaleString('en-IN', {
                                                                                        maximumFractionDigits: 2,
                                                                                        style: 'currency',
                                                                                        currency: 'INR'
                                                                                    })}
                                                                                </b>
                                                                            </TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell>
                                                                                <b>
                                                                                    {calculatetqtrqtrtpos(values).toLocaleString('en-IN', {
                                                                                        maximumFractionDigits: 2,
                                                                                        style: 'currency',
                                                                                        currency: 'INR'
                                                                                    })}
                                                                                </b>
                                                                            </TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell>
                                                                                <b>
                                                                                    {calculatetqtrqttdpd0(values).toLocaleString('en-IN', {
                                                                                        maximumFractionDigits: 2,
                                                                                        style: 'currency',
                                                                                        currency: 'INR'
                                                                                    })}
                                                                                </b>
                                                                            </TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell>
                                                                                <b>
                                                                                    {calculatetqtrqtdpd1To30(values).toLocaleString('en-IN', {
                                                                                        maximumFractionDigits: 2,
                                                                                        style: 'currency',
                                                                                        currency: 'INR'
                                                                                    })}
                                                                                </b>
                                                                            </TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell>
                                                                                <b>
                                                                                    {calculatetqtrqtdptdpd31To60(values).toLocaleString('en-IN', {
                                                                                        maximumFractionDigits: 2,
                                                                                        style: 'currency',
                                                                                        currency: 'INR'
                                                                                    })}
                                                                                </b>
                                                                            </TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell>
                                                                                <b>
                                                                                    {calculatetqtrqtdptdpdtdpd61To90(values).toLocaleString('en-IN', {
                                                                                        maximumFractionDigits: 2,
                                                                                        style: 'currency',
                                                                                        currency: 'INR'
                                                                                    })}
                                                                                </b>
                                                                            </TableCell>
                                                                        }
                                                                        {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                            <TableCell>
                                                                                <b>
                                                                                    {calculatetqtrqtdptdpdtdtdpdAbove90(values).toLocaleString('en-IN', {
                                                                                        maximumFractionDigits: 2,
                                                                                        style: 'currency',
                                                                                        currency: 'INR'
                                                                                    })}
                                                                                </b>
                                                                            </TableCell>
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










import { useState, useEffect } from "react";
import { FieldArray, Form, Formik } from 'formik';
import AutoSave from '../../../components/framework/AutoSave';
import { Button, Grid, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { connect } from 'react-redux';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useAppSelector } from "../../../app/hooks";
import { useGetPFCutsAmtWiseFormDataQuery, useSavePFCutsAmtWiseFormDetailsMutation } from "../../../features/application-form/Portfoliocuts";
import { AdvanceTextBoxField } from "../../../components/framework/AdvanceTextBoxField";
import { OnlineSnackbar } from "../../../components/shared/OnlineSnackbar";
import ConfirmationAlertDialog from "../../../models/application-form/ConfirmationAlertDialog";
import SaveAsIcon from '@mui/icons-material/SaveAs';
import FullScreenLoaderNoClose from "../../../components/common/FullScreenLoaderNoClose";
import React from "react";
import DrawerResponseComponent from "../../../components/DrawerComponent/DrawerResponseComponent";
import NotificationSectionWiseButton from "../../../components/DrawerComponent/NotificationSectionWiseButton";
import { useUpdateCommentByNIdMutation } from "../../../features/application-form/applicationForm";
import Notification from "../../../components/shared/Notification";

const SanctionedAmountWisePortfolioCutsTable = ({ excelData, openSectionsData }: any) => {
    const { applId, transactionData } = useAppSelector((state) => state.userStore);
    const [addSavePFCutsAmtWiseForm] = useSavePFCutsAmtWiseFormDetailsMutation();
    const { data: getPFCutsAmtWise } = useGetPFCutsAmtWiseFormDataQuery(applId);
    const [initialValues, setInitialValues] = useState<any>({ data: [] });
    const [openConfirmation, setOpenConfirmation] = useState(false);
    const [formData, setFormData] = useState<any>("");
    const [actionVal, setActionVal] = useState<any>("");
    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<any>("");
    const [severity, setSeverity] = useState<string | any>("success");
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [snackMsgList, setSnackMsgList] = useState<any>("");

    const [snackOpen, setSnackOpen] = useState(false);
    const [snackSeverity, setSnackSeverity] = useState<'error' | 'success' | 'info'>('error');
    const [snackMessages, setSnackMessages] = useState<string[]>([]);

    useEffect(() => {
        if (getPFCutsAmtWise) {
            setInitialValues({ data: getPFCutsAmtWise });
        }
    }, [getPFCutsAmtWise, applId]);


    const handleSubmitApis = async (values: any) => {
        let finalValue = values?.data?.map((listData: any, index: number) => {
            return {
                ...listData,
                applId,
            };
        });
        if (!finalValue) {
            finalValue = values?.map((listData: any, index: number) => {
                return {
                    ...listData,
                    applId,
                };
            });
        }
        try {
            setIsUploading(true);
            if (await addSavePFCutsAmtWiseForm(finalValue).unwrap()) {
                setOpenSnackbar(true);
                setSeverity("success");
                setIsUploading(false);
                if (finalValue?.[0]?.saveStatus === '02') {
                    setSnackMsg("Section submitted successfully");
                } else {
                    setSnackMsg("Record saved successfully");
                }
                return true;
            }
            return false;
        } catch (error: any) {
            setOpenSnackbar(true);
            setIsUploading(false);
            setSeverity("error");
            setSnackMsg("Failed to save: " + error?.message);
            return false;
        }
    };

    const handleCloseConfirmation = () => {
        setActionVal(null);
        setOpenConfirmation(false);
    };

    const handleSubmitConfirmation = (values: any) => {
        const finalValue = values?.data?.map((listData: any) => {
            return {
                ...listData,
                saveStatus: '02',
            };
        });
        setOpenConfirmation(false);
        handleSubmitApis(finalValue);
    };

    const handleSubmit = async (values: any) => {
        if (actionVal === '02') {
            setFormData(values);
            setOpenConfirmation(true);
        } else {
            handleSubmitApis(values);
        }
        setActionVal(null);
    };

    const handleClickSetAction = (action: any) => {
        setActionVal(action);
    };

    const calculation = (setFieldValue: any, values: any, currentIndex: number, currentVal: number, currentRowId: string) => {
        calculationTotal(setFieldValue, values, currentIndex, currentVal, currentRowId);

        if (currentRowId === 'qtrDpd0' || currentRowId === 'qtrDpd1To30' || currentRowId === 'qtrDpd31To60' ||
            currentRowId === 'qtrDpd61To90' || currentRowId === 'qtrDpdAbove90') {
            calculationCurrentFy(setFieldValue, values, currentIndex, currentVal, currentRowId);
        } else if (currentRowId === 'tdpd0' || currentRowId === 'tdpd1To30' || currentRowId === 'tdpd31To60' ||
            currentRowId === 'tdpd61To90' || currentRowId === 'tdpdAbove90') {
            calculationCurrentFyQtr(setFieldValue, values, currentIndex, currentVal, currentRowId);
        }
    };

    const calculationCurrentFy = (setFieldValue: any, values: any, currentIndex: number, currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const qtrDpd0 = currentRowId === 'qtrDpd0' ? currentVal : currentRow.qtrDpd0;
        const qtrDpd1To30 = currentRowId === 'qtrDpd1To30' ? currentVal : currentRow.qtrDpd1To30;
        const qtrDpd31To60 = currentRowId === 'qtrDpd31To60' ? currentVal : currentRow.qtrDpd31To60;
        const qtrDpd61To90 = currentRowId === 'qtrDpd61To90' ? currentVal : currentRow.qtrDpd61To90;
        const qtrDpdAbove90 = currentRowId === 'qtrDpdAbove90' ? currentVal : currentRow.qtrDpdAbove90;

        const total = +qtrDpd0 + +qtrDpd1To30 + +qtrDpd31To60 + +qtrDpd61To90 + +qtrDpdAbove90;
        const totalPrefix = 'data.' + currentIndex + '.qtrPos';
        setFieldValue(`${totalPrefix}`, total.toFixed(2));
        calculationTotal(setFieldValue, values, currentIndex, Number(total.toFixed(2)), 'qtrPos');
    };

    const calculationCurrentFyQtr = (setFieldValue: any, values: any, currentIndex: number, currentVal: number, currentRowId: string) => {
        const currentRow = values.data[currentIndex];
        const qtrDpd0 = currentRowId === 'tdpd0' ? currentVal : currentRow.tdpd0;
        const qtrDpd1To30 = currentRowId === 'tdpd1To30' ? currentVal : currentRow.tdpd1To30;
        const qtrDpd31To60 = currentRowId === 'tdpd31To60' ? currentVal : currentRow.tdpd31To60;
        const qtrDpd61To90 = currentRowId === 'tdpd61To90' ? currentVal : currentRow.tdpd61To90;
        const qtrDpdAbove90 = currentRowId === 'tdpdAbove90' ? currentVal : currentRow.tdpdAbove90;

        const total = +qtrDpd0 + +qtrDpd1To30 + +qtrDpd31To60 + +qtrDpd61To90 + +qtrDpdAbove90;
        const totalPrefix = 'data.' + currentIndex + '.tpos';
        setFieldValue(`${totalPrefix}`, total.toFixed(2));
        calculationTotal(setFieldValue, values, currentIndex, Number(total.toFixed(2)), 'tpos');
    };

    const calculationTotal = (setFieldValue: any, values: any, currentIndex: number, currentVal: number, currentRowId: string) => {
        const currentRowVal = currentVal;
        let total = 0;
        for (let i = 0; i < values.data.length - 1; i++) {
            if (i !== currentIndex) {
                total = (+total + +getRowValue(values, i, currentRowId));
            }
        }
        total = (+currentRowVal + +total);
        const totalPrefix = 'data.12.' + currentRowId;
        setFieldValue(`${totalPrefix}`, total.toFixed(2));
    };

    const getRowValue = (values: any, index: number, currentRowId: string) => {
        if (currentRowId === 'tdpd1To30') {
            return values.data[index].tdpd1To30;
        } else if (currentRowId === 'tdpd31To60') {
            return values.data[index].tdpd31To60;
        } else if (currentRowId === 'tdpd61To90') {
            return values.data[index].tdpd61To90;
        } else if (currentRowId === 'tdpdAbove90') {
            return values.data[index].tdpdAbove90;
        } else if (currentRowId === "tdpd0") {
            return values.data[index].tdpd0;
        } else if (currentRowId === "tminus2Loans") {
            return values.data[index].tminus2Loans;
        } else if (currentRowId === "tminus2Pos") {
            return values.data[index].tminus2Pos;
        } else if (currentRowId === "tminus1Loans") {
            return values.data[index].tminus1Loans;
        } else if (currentRowId === "tminus1Pos") {
            return values.data[index].tminus1Pos;
        } else if (currentRowId === "qtrLoans") {
            return values.data[index].qtrLoans;
        } else if (currentRowId === "qtrPos") {
            return values.data[index].qtrPos;
        } else if (currentRowId === "qtrDpd0") {
            return values.data[index].qtrDpd0;
        } else if (currentRowId === "qtrDpd1To30") {
            return values.data[index].qtrDpd1To30;
        } else if (currentRowId === "qtrDpd31To60") {
            return values.data[index].qtrDpd31To60;
        } else if (currentRowId === "qtrDpd61To90") {
            return values.data[index].qtrDpd61To90;
        } else if (currentRowId === "qtrDpdAbove90") {
            return values.data[index].qtrDpdAbove90;
        } else if (currentRowId === "tloans") {
            return values.data[index].tloans;
        } else if (currentRowId === "tpos") {
            return values.data[index].tpos;
        }
    };

    const handleClose = () => {
        setOpenSnackbar(false);
    };

    const processExcelData = (excelData: any[], formData: any[]) => {
        const mappedData = formData.map((row: any) => {
            const excelRow = findMatchingExcelRow(excelData, row.amtSlab);
            if (excelRow) {
                const parsedRow = {
                    ...row,
                    tminus2Loans: parseExcelValue(excelRow[1]),
                    tminus2Pos: parseExcelValue(excelRow[2]),
                    tminus1Loans: parseExcelValue(excelRow[3]),
                    tminus1Pos: parseExcelValue(excelRow[4]),
                    qtrLoans: parseExcelValue(excelRow[5]),
                    qtrDpd0: parseExcelValue(excelRow[7]),
                    qtrDpd1To30: parseExcelValue(excelRow[8]),
                    qtrDpd31To60: parseExcelValue(excelRow[9]),
                    qtrDpd61To90: parseExcelValue(excelRow[10]),
                    qtrDpdAbove90: parseExcelValue(excelRow[11]),
                    tloans: parseExcelValue(excelRow[12]),
                    tdpd0: parseExcelValue(excelRow[14]),
                    tdpd1To30: parseExcelValue(excelRow[15]),
                    tdpd31To60: parseExcelValue(excelRow[16]),
                    tdpd61To90: parseExcelValue(excelRow[17]),
                    tdpdAbove90: parseExcelValue(excelRow[18]),
                };
                parsedRow.qtrPos = calculateQtrPos(parsedRow);
                parsedRow.tpos = calculateTpos(parsedRow);
                return parsedRow;
            }
            return row;
        });

        const updatedDataWithTotals = calculateTotalsForExcel(mappedData);
        return updatedDataWithTotals;
    };

    const calculateQtrPos = (row: any) => {
        const qtrDpd0 = parseFloat(row.qtrDpd0) || 0;
        const qtrDpd1To30 = parseFloat(row.qtrDpd1To30) || 0;
        const qtrDpd31To60 = parseFloat(row.qtrDpd31To60) || 0;
        const qtrDpd61To90 = parseFloat(row.qtrDpd61To90) || 0;
        const qtrDpdAbove90 = parseFloat(row.qtrDpdAbove90) || 0;
        return (qtrDpd0 + qtrDpd1To30 + qtrDpd31To60 + qtrDpd61To90 + qtrDpdAbove90).toFixed(2);
    };

    const calculateTpos = (row: any) => {
        const tdpd0 = parseFloat(row.tdpd0) || 0;
        const tdpd1To30 = parseFloat(row.tdpd1To30) || 0;
        const tdpd31To60 = parseFloat(row.tdpd31To60) || 0;
        const tdpd61To90 = parseFloat(row.tdpd61To90) || 0;
        const tdpdAbove90 = parseFloat(row.tdpdAbove90) || 0;
        return (tdpd0 + tdpd1To30 + tdpd31To60 + tdpd61To90 + tdpdAbove90).toFixed(2);
    };

    const calculateTotalsForExcel = (data: any[]) => {
        const totalRowIndex = data.findIndex(row => row.amtSlab === "Sub Total");
        if (totalRowIndex !== -1) {
            const fieldsToSum = [
                'tminus2Loans', 'tminus2Pos', 'tminus1Loans', 'tminus1Pos',
                'qtrLoans', 'qtrPos', 'qtrDpd0', 'qtrDpd1To30', 'qtrDpd31To60',
                'qtrDpd61To90', 'qtrDpdAbove90', 'tloans', 'tpos', 'tdpd0',
                'tdpd1To30', 'tdpd31To60', 'tdpd61To90', 'tdpdAbove90'
            ];
            const totalRow = { ...data[totalRowIndex] };
            fieldsToSum.forEach(field => {
                totalRow[field] = data
                    .filter(row => row.amtSlab !== "Sub Total")
                    .reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0)
                    .toFixed(2);
            });
            data[totalRowIndex] = totalRow;
        }
        return data;
    };

    const findMatchingExcelRow = (jsonData: any[], amtSlab: string): any[] | null => {
        for (let i = 3; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row[0] && row[0].toString().trim() === amtSlab.trim()) {
                return row;
            }
        }
        if (amtSlab === "Sub Total") {
            for (let i = 3; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row && row[0] && typeof row[0] === 'string' && row[0].toString().toLowerCase().includes('total')) {
                    return row;
                }
            }
        }
        return null;
    };

    const parseExcelValue = (value: any): number => {
        if (value === undefined || value === null || value === '') return 0;
        if (typeof value === 'string') return parseFloat(value.replace(/,/g, '')) || 0;
        return parseFloat(value.toFixed(2)) || 0;
    };

    useEffect(() => {
        if (excelData && excelData.length > 0 && getPFCutsAmtWise) {
            const processedData = processExcelData(excelData, getPFCutsAmtWise);
            setInitialValues({ data: processedData });
            setOpenSnackbar(true);
            setSeverity("success");
            setSnackMsg("Sanctioned Amount-wise data imported successfully");
        }
    }, [excelData]);

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
                            >
                                {({ values, setFieldValue }) => {
                                    return (
                                        <Form>
                                            <fieldset disabled={values?.data?.[0]?.saveStatus === "02"}>
                                                {values?.data?.[0]?.saveStatus !== "02" &&
                                                    <AutoSave handleSubmit={handleSubmit} values={values} debounceMs={30000} autoStyle={true} />
                                                }
                                                <FieldArray name="data">
                                                    {() => (
                                                        <Table sx={{ minWidth: 650 }} aria-label="simple table">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableCell align='center'><b>Amount (INR, thousand)</b></TableCell>
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
                                                                    <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>POS</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>POS</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>POS</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>{">"}0</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>1-30</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>31-60</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>61-90</b></TableCell>
                                                                    <TableCell style={{ minWidth: '100px' }}><b>{">"}90</b></TableCell>
                                                                    {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                        <TableCell style={{ minWidth: '100px' }}><b>No. of Loans</b></TableCell>
                                                                    }
                                                                    {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                        <TableCell style={{ minWidth: '100px' }}><b>POS</b></TableCell>
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
                                                                {
                                                                    values?.data?.map((item: any, index: any) => (
                                                                        <TableRow key={item?.slNo}
                                                                            sx={item?.amtSlab === "Sub Total" ? {
                                                                                backgroundColor: "gray.100",
                                                                                fontWeight: "bold"
                                                                            } : {}}>
                                                                            <TableCell>
                                                                                <p>{item?.amtSlab}</p>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus2Loans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'tminus2Loans')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus2Pos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'tminus2Pos')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus1Loans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'tminus1Loans')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.tminus1Pos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'tminus1Pos')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrLoans`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'qtrLoans')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                    allowNegative={false}
                                                                                    allowDecimal={false}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrPos`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'qtrPos')}
                                                                                    type={'number'}
                                                                                    disabled={true}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd0`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'qtrDpd0')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd1To30`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'qtrDpd1To30')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd31To60`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'qtrDpd31To60')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpd61To90`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'qtrDpd61To90')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <AdvanceTextBoxField
                                                                                    name={`data.${index}.qtrDpdAbove90`}
                                                                                    onCustomChange={(currentVal: any) =>
                                                                                        calculation(setFieldValue, values, index,
                                                                                            currentVal, 'qtrDpdAbove90')}
                                                                                    type={'number'}
                                                                                    disabled={index === 12}
                                                                                />
                                                                            </TableCell>

                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tloans`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index,
                                                                                                currentVal, 'tloans')}
                                                                                        type={'number'}
                                                                                        disabled={index === 12}
                                                                                        allowNegative={false}
                                                                                        allowDecimal={false}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tpos`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index,
                                                                                                currentVal, 'tpos')}
                                                                                        type={'number'}
                                                                                        disabled={true}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpd0`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index,
                                                                                                currentVal, 'tdpd0')}
                                                                                        type={'number'}
                                                                                        disabled={index === 12}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpd1To30`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index,
                                                                                                currentVal, 'tdpd1To30')}
                                                                                        type={'number'}
                                                                                        disabled={index === 12}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpd31To60`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index,
                                                                                                currentVal, 'tdpd31To60')}
                                                                                        type={'number'}
                                                                                        disabled={index === 12}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpd61To90`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index,
                                                                                                currentVal, 'tdpd61To90')}
                                                                                        type={'number'}
                                                                                        disabled={index === 12}
                                                                                    />
                                                                                </TableCell>
                                                                            }
                                                                            {transactionData?.lstAudQ !== 'Not Applicable' &&
                                                                                <TableCell>
                                                                                    <AdvanceTextBoxField
                                                                                        name={`data.${index}.tdpdAbove90`}
                                                                                        onCustomChange={(currentVal: any) =>
                                                                                            calculation(setFieldValue, values, index,
                                                                                                currentVal, 'tdpdAbove90')}
                                                                                        type={'number'}
                                                                                        disabled={index === 12}
                                                                                    />
                                                                                </TableCell>
                                                                            }
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
                                    );
                                }}
                            </Formik>
                        </div>
                        <OnlineSnackbar open={openSnackbar} msg={snackMsg} severity={severity}
                            handleSnackClose={handleClose} />
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


[
  {
    "applId": "string",
    "slNo": 0,
    "saveStatus": "string",
    "minAmtSlab": "string",
    "maxAmtSlab": "string",
    "lastFyEndT": "2025-09-03",
    "tminus2Loans": 1000000,
    "tminus2Pos": 1000000,
    "tminus1Loans": 1000000,
    "tminus1Pos": 1000000,
    "qtrLoans": 1000000,
    "qtrPos": 1000000,
    "qtrDpd0": 1000000,
    "qtrDpd1To30": 1000000,
    "qtrDpd31To60": 1000000,
    "qtrDpd61To90": 1000000,
    "qtrDpdAbove90": 1000000,
    "particulars": "string",
    "tpos": 0,
    "tloans": 0,
    "tdpd0": 0,
    "tdpd1To30": 0,
    "tdpd31To60": 0,
    "tdpd61To90": 0,
    "tdpdAbove90": 0
  }
]
