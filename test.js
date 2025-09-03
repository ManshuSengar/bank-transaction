import {
    Button,
    FormControl,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Grid
} from "@mui/material";
import { Formik, Form, FieldArray } from "formik";
import * as Yup from "yup";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AutoSave from "../../../../components/framework/AutoSave";
import { TextBoxField } from "../../../../components/framework/TextBoxField";
import NbfcSnackbar from "../../../../components/shared/NbfcSnackbar";
import { useAppSelector } from "../../../../app/hooks";
import {
    useSaveFundingMutation,
    useFundingGapByIdQuery
} from "../../../../features/appraisal/cashFlowProjectionsApi";
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ConfirmationAlertDialog from "../../../../models/application-form/ConfirmationAlertDialog";
import { useUpdateCommentByNIdMutation } from "../../../../features/application-form/applicationForm";
import NotificationSectionWiseButton from "../../../../components/DrawerComponent/NotificationSectionWiseButton";
import DrawerResponseComponent from "../../../../components/DrawerComponent/DrawerResponseComponent";
import React from "react";
import Notification from "../../../../components/shared/Notification";

const validationSchema = Yup.object().shape({
    rows: Yup.array().of(
        Yup.object().shape({
            tplus1Proj: Yup.string().when('particulars', {
                is: (particulars: string) => {
                    return particulars && !(
                        particulars.includes("Total Fund required:") ||
                        particulars.includes("Sub Total [A]") ||
                        particulars.includes("Sub-total [B]") ||
                        particulars.includes("Fund required [Gap]")
                    );
                },
                then: (schema) =>
                    schema
                        .test("non-negative", "Negative values are not allowed", (value) => {
                            return !value || parseFloat(value) >= 0;
                        })
                        .matches(/^\d*\.?\d{0,2}$/, "Must be a valid number with up to two decimal places")
                        .required("Required and must pe postive"),
                otherwise: (schema) =>
                    schema
                        .matches(/^-?\d*\.?\d{0,2}$/, "Must be a valid number with up to two decimal places")
                        .required("Required and must pe postive"),
            }),
            tplus2Proj: Yup.string().when('particulars', {
                is: (particulars: string) => {
                    return particulars && !(
                        particulars.includes("Total Fund required:") ||
                        particulars.includes("Sub Total [A]") ||
                        particulars.includes("Sub-total [B]") ||
                        particulars.includes("Fund required [Gap]")
                    );
                },
                then: (schema) =>
                    schema
                        .test("non-negative", "Negative values are not allowed", (value) => {
                            return !value || parseFloat(value) >= 0;
                        })
                        .matches(/^\d*\.?\d{0,2}$/, "Must be a valid number with up to two decimal places")
                        .required("Required and must pe postive"),
                otherwise: (schema) =>
                    schema
                        .matches(/^-?\d*\.?\d{0,2}$/, "Must be a valid number with up to two decimal places")
                        .required("Required and must pe postive"),
            }),
        })
    ),
});

const FundingGap = ({ userData, openSectionsData }: any) => {
    const { applId, transactionData } = useAppSelector((state: any) => state.userStore);
    const [updateFundingGap] = useSaveFundingMutation();
    const { data: fundingGapData } = useFundingGapByIdQuery(applId);
    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<any>("");
    const [severity, setSeverity] = useState<string | any>("success");
    const [actionVal, setActionVal] = useState<any>("");
    const [pendingSubmitValues, setPendingSubmitValues] = useState<any>(null); // Store form values for confirmation
    const [openConfirmation, setOpenConfirmation] = useState(false);

    const handleSnackClose = () => {
        setOpenSnackbar(false);
    };

    // Modified to handle form submission with confirmation
    const handleFormSubmit = async (values: any, action: string) => {
        if (action === '02') {
            // For submit action, show confirmation modal first
            setPendingSubmitValues(values);
            setActionVal(action);
            setOpenConfirmation(true);
            return; // Don't submit yet, wait for confirmation
        } else {
            // For save action, submit immediately
            setActionVal(action);
            await performSubmit(values, action);
        }
    };

    const performSubmit = async (values: any, action: string) => {
        try {
            const requestBody = values?.rows?.map((row: any, index: number) => ({
                slNo: index + 1,
                applId: applId,
                particulars: row?.particulars || "",
                tplus1Proj: row.tplus1Proj || "",
                tplus2Proj: row.tplus2Proj || "",
                saveStatus: action
            }));
            
            const response = await updateFundingGap(requestBody).unwrap();
            
            if (response && action === '01') {
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg("Record saved successfully");
            } else if (response && action === '02') {
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg("Record submitted successfully");
            }
            
            setActionVal(null);
            setPendingSubmitValues(null);
        } catch (err) {
            console.error("Error saving data:", err);
            setActionVal(null);
            setPendingSubmitValues(null);
        }
    };

    const handleSubmitConfirmation = async () => {
        setOpenConfirmation(false);
        if (pendingSubmitValues && actionVal) {
            await performSubmit(pendingSubmitValues, actionVal);
        }
    };

    const handleCloseConfirmation = () => {
        setActionVal(null);
        setPendingSubmitValues(null);
        setOpenConfirmation(false);
    };

    const [initialValues, setInitialValues] = useState<any>({
        rows: []
    });

    useEffect(() => {
        if (fundingGapData && fundingGapData?.length > 0) {
            const dataWithApplId = fundingGapData.map((item: any) => ({
                ...item,
                applId
            }));
            setInitialValues({ rows: dataWithApplId });
        }
    }, [fundingGapData, applId]);

    const handleSubmit = async (values: any) => {
        // This should only be called for auto-save, not for button clicks
        if (actionVal) {
            await handleFormSubmit(values, actionVal);
        }
        return false; // Prevent default form submission
    };

    const calculateSubtotal = (items: any[]) => {
        return items.reduce(
            (total, item) => {
                const plusOne = parseFloat(item.tplus1Proj) || 0;
                const plusTwo = parseFloat(item.tplus2Proj) || 0;
                return {
                    tplus1Proj: total.tplus1Proj + plusOne,
                    tplus2Proj: total.tplus2Proj + plusTwo,
                };
            },
            { tplus1Proj: 0, tplus2Proj: 0 }
        );
    };

    const calculateGap = (subTotalA: any, subTotalB: any) => {
        return {
            tplus1Proj:
                (parseFloat(subTotalA.tplus1Proj) || 0) -
                (parseFloat(subTotalB.tplus1Proj) || 0),
            tplus2Proj:
                (parseFloat(subTotalA.tplus2Proj) || 0) -
                (parseFloat(subTotalB.tplus2Proj) || 0),
        };
    };

    const loginData: any = Cookies.get("user") || null;
    const loginCookiesData: any = JSON.parse(loginData);

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

    return (
        <>
            {
                !transactionData ? <Notification /> :
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
                                        (item: any) => item?.sectionId === "15" && item?.subSectionId === "04"
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
                        <div className="wrap-accordian custome-form">
                            <ConfirmationAlertDialog
                                id={applId}
                                type={4}
                                open={openConfirmation}
                                handleClose={handleCloseConfirmation}
                                values={pendingSubmitValues}
                                handleDelete={handleSubmitConfirmation} />

                            <Formik
                                initialValues={initialValues}
                                onSubmit={handleSubmit}
                                validateOnChange={true}
                                validationSchema={validationSchema}
                                validate={(values) => {
                                    const newValues = { ...values };
                                    let subTotalA: any = { tplus1Proj: "0", tplus2Proj: "0" };
                                    let subTotalB: any = { tplus1Proj: "0", tplus2Proj: "0" };

                                    values?.rows?.forEach((row: any, index: any) => {
                                        if (row.particulars.includes("Sub Total [A]")) {
                                            const rowsAboveA = values.rows.slice(1, index);
                                            subTotalA = calculateSubtotal(rowsAboveA);
                                            newValues.rows[index].tplus1Proj = subTotalA.tplus1Proj.toFixed(2);
                                            newValues.rows[index].tplus2Proj = subTotalA.tplus2Proj.toFixed(2);
                                        } else if (row.particulars.includes("Sub-total [B]")) {
                                            const rowsAboveB = values.rows.slice(5, index);
                                            subTotalB = calculateSubtotal(rowsAboveB);
                                            newValues.rows[index].tplus1Proj = subTotalB.tplus1Proj.toFixed(2);
                                            newValues.rows[index].tplus2Proj = subTotalB.tplus2Proj.toFixed(2);
                                        } else if (row.particulars.includes("Fund required [Gap]")) {
                                            const rowsAboveA = values.rows.slice(1, 4);
                                            subTotalA = calculateSubtotal(rowsAboveA);
                                            const rowsAboveB = values.rows.slice(5, 8);
                                            subTotalB = calculateSubtotal(rowsAboveB);
                                            const { tplus1Proj, tplus2Proj } = calculateGap(subTotalA, subTotalB);
                                            newValues.rows[index].tplus1Proj = tplus1Proj.toFixed(2);
                                            newValues.rows[index].tplus2Proj = tplus2Proj.toFixed(2);
                                        } else if (row.particulars.includes("Total Fund required:")) {
                                            const subTotalARow = values.rows.find((r: { particulars: string | string[]; }) => r.particulars.includes("Sub Total [A]"));
                                            const subTotalBRow = values.rows.find((r: { particulars: string | string[]; }) => r.particulars.includes("Sub-total [B]"));

                                            const tplus1Proj =
                                                (parseFloat(subTotalARow?.tplus1Proj || "0") + parseFloat(subTotalBRow?.tplus1Proj || "0")).toFixed(2);
                                            const tplus2Proj =
                                                (parseFloat(subTotalARow?.tplus2Proj || "0") + parseFloat(subTotalBRow?.tplus2Proj || "0")).toFixed(2);

                                            newValues.rows[index].tplus1Proj = tplus1Proj;
                                            newValues.rows[index].tplus2Proj = tplus2Proj;
                                        }
                                    });

                                    return {};
                                }}
                                validateOnBlur={false}
                                enableReinitialize={true}
                            >
                                {({ values, submitForm }) => (
                                    <Form>
                                        <fieldset disabled={values?.rows?.[0]?.saveStatus === "02"}>
                                            {values?.rows?.[0]?.saveStatus !== "02" && (
                                                <AutoSave debounceMs={5000} values={values} onSubmit={handleSubmit} />
                                            )}
                                            <div className="wrap-inner-table">
                                                <Table>
                                                    <TableBody>
                                                        <TableRow sx={{ backgroundColor: "rgb(244, 244, 244)" }}>
                                                            <TableCell>
                                                                <strong>Particulars</strong>
                                                            </TableCell>
                                                            <TableCell sx={{ minWidth: 300 }}>
                                                                <strong>Projections for FY {transactionData?.lstAudYrTp1 || "FY-T+1"}</strong>
                                                            </TableCell>
                                                            <TableCell sx={{ minWidth: 400 }}>
                                                                <strong>Projections for FY  {transactionData?.lstAudYrTp2 || "FY-T+2"}</strong>
                                                            </TableCell>
                                                        </TableRow>

                                                        <FieldArray name="rows">
                                                            {() =>
                                                                values?.rows?.map((row: any, index: number) => (
                                                                    <TableRow key={`row-${index}`}>
                                                                        <TableCell>{row.particulars}</TableCell>
                                                                        <TableCell sx={{ minWidth: 300 }}>
                                                                            <FormControl fullWidth>
                                                                                <TextBoxField
                                                                                    label=""
                                                                                    name={`rows.${index}.tplus1Proj`}
                                                                                    type="number"
                                                                                    disabled={
                                                                                        row.particulars.includes("Total Fund required:") ||
                                                                                        row.particulars.includes("Sub Total [A]") ||
                                                                                        row.particulars.includes("Sub-total [B]") ||
                                                                                        row.particulars.includes("Fund required [Gap]")
                                                                                    }
                                                                                />
                                                                            </FormControl>
                                                                        </TableCell>
                                                                        <TableCell sx={{ minWidth: 300 }}>
                                                                            <FormControl fullWidth>
                                                                                <TextBoxField
                                                                                    label=""
                                                                                    name={`rows.${index}.tplus2Proj`}
                                                                                    type="number"
                                                                                    disabled={
                                                                                        row.particulars.includes("Total Fund required:") ||
                                                                                        row.particulars.includes("Sub Total [A]") ||
                                                                                        row.particulars.includes("Sub-total [B]") ||
                                                                                        row.particulars.includes("Fund required [Gap]")
                                                                                    }
                                                                                />
                                                                            </FormControl>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            }
                                                        </FieldArray>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            {values?.rows?.[0]?.saveStatus !== "02" &&
                                                <Button 
                                                    className="sbmtBtn psn_btn mt-3 mb-3 ms-3" 
                                                    type='button'
                                                    onClick={() => handleFormSubmit(values, '01')}
                                                    variant="contained"
                                                > 
                                                    Save <CheckCircleOutlineIcon />
                                                </Button>
                                            }
                                            {values?.rows?.[0]?.saveStatus !== "02" &&
                                                <Button 
                                                    className="sbmtBtn sbmtBtn_scn psn_btn mt-3 mb-3 ms-3" 
                                                    type='button'
                                                    onClick={() => handleFormSubmit(values, '02')}
                                                    variant="contained"
                                                > 
                                                    Submit <SaveAsIcon />
                                                </Button>
                                            }
                                        </fieldset>
                                    </Form>
                                )}
                            </Formik>
                        </div>
                        <NbfcSnackbar open={openSnackbar} msg={snackMsg} severity={severity}
                            handleSnackClose={handleSnackClose} submitCall={false} />
                    </>
            }
        </>
    );
};

export default FundingGap;







import {
    Button,
    FormControl,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Grid
} from "@mui/material";
import { Formik, Form, FieldArray } from "formik";
import * as Yup from "yup";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AutoSave from "../../../../components/framework/AutoSave";
import { TextBoxField } from "../../../../components/framework/TextBoxField";
import NbfcSnackbar from "../../../../components/shared/NbfcSnackbar";
import { useAppSelector } from "../../../../app/hooks";
import {
    useSaveFundingMutation,
    useFundingGapByIdQuery
} from "../../../../features/appraisal/cashFlowProjectionsApi";
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ConfirmationAlertDialog from "../../../../models/application-form/ConfirmationAlertDialog";
import { useUpdateCommentByNIdMutation } from "../../../../features/application-form/applicationForm";
import NotificationSectionWiseButton from "../../../../components/DrawerComponent/NotificationSectionWiseButton";
import DrawerResponseComponent from "../../../../components/DrawerComponent/DrawerResponseComponent";
import React from "react";
import Notification from "../../../../components/shared/Notification";

const validationSchema = Yup.object().shape({
    rows: Yup.array().of(
        Yup.object().shape({
            tplus1Proj: Yup.string().when('particulars', {
                is: (particulars: string) => {
                    return particulars && !(
                        particulars.includes("Total Fund required:") ||
                        particulars.includes("Sub Total [A]") ||
                        particulars.includes("Sub-total [B]") ||
                        particulars.includes("Fund required [Gap]")
                    );
                },
                then: (schema) =>
                    schema
                        .test("non-negative", "Negative values are not allowed", (value) => {
                            return !value || parseFloat(value) >= 0;
                        })
                        .matches(/^\d*\.?\d{0,2}$/, "Must be a valid number with up to two decimal places")
                        .required("Required and must pe postive"),
                otherwise: (schema) =>
                    schema
                        .matches(/^-?\d*\.?\d{0,2}$/, "Must be a valid number with up to two decimal places")
                        .required("Required and must pe postive"),
            }),
            tplus2Proj: Yup.string().when('particulars', {
                is: (particulars: string) => {
                    return particulars && !(
                        particulars.includes("Total Fund required:") ||
                        particulars.includes("Sub Total [A]") ||
                        particulars.includes("Sub-total [B]") ||
                        particulars.includes("Fund required [Gap]")
                    );
                },
                then: (schema) =>
                    schema
                        .test("non-negative", "Negative values are not allowed", (value) => {
                            return !value || parseFloat(value) >= 0;
                        })
                        .matches(/^\d*\.?\d{0,2}$/, "Must be a valid number with up to two decimal places")
                        .required("Required and must pe postive"),
                otherwise: (schema) =>
                    schema
                        .matches(/^-?\d*\.?\d{0,2}$/, "Must be a valid number with up to two decimal places")
                        .required("Required and must pe postive"),
            }),
        })
    ),
});

const FundingGap = ({ userData, openSectionsData }: any) => {
    const { applId, transactionData } = useAppSelector((state: any) => state.userStore);
    const [updateFundingGap] = useSaveFundingMutation();
    const { data: fundingGapData } = useFundingGapByIdQuery(applId);
    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<any>("");
    const [severity, setSeverity] = useState<string | any>("success");
    const [actionVal, setActionVal] = useState<any>("");
    const [formData, setFormData] = useState<any>("");
    const [openConfirmation, setOpenConfirmation] = useState(false);

    const handleSnackClose = () => {
        setOpenSnackbar(false);
    };

    const handleClickSetAction = (action: any) => {
        setActionVal(action);
        if (action === '02') {
            setOpenConfirmation(true);
        }
    };

    const handleSubmitConfirmation = () => {
        setOpenConfirmation(false);
        setFormData((prev: any) => ({ ...prev, key: "02" }));
    };

    const [initialValues, setInitialValues] = useState<any>({
        rows: []
    });

    useEffect(() => {
        if (fundingGapData && fundingGapData?.length > 0) {
            const dataWithApplId = fundingGapData.map((item: any) => ({
                ...item,
                applId
            }));
            setInitialValues({ rows: dataWithApplId });
        }
    }, [fundingGapData, applId]);

    const handleSubmit = async (values: any) => {
        try {
            const requestBody = values?.rows?.map((row: any, index: number) => ({
                slNo: index + 1,
                applId: applId,
                particulars: row?.particulars || "",
                tplus1Proj: row.tplus1Proj || "",
                tplus2Proj: row.tplus2Proj || "",
                saveStatus: actionVal
            }));
            const response = await updateFundingGap(requestBody).unwrap();
            if (response && actionVal === '01') {
                setOpenSnackbar(true);
                setSeverity("success");
                setSnackMsg("Record saved successfully");
                return false;
            }
            setActionVal(null);
            return true;
        } catch (err) {
            console.error("Error saving data:", err);
        }
    };

    const handleCloseConfirmation = () => {
        setActionVal(null);
        setOpenConfirmation(false);
    };

    const calculateSubtotal = (items: any[]) => {
        return items.reduce(
            (total, item) => {
                const plusOne = parseFloat(item.tplus1Proj) || 0;
                const plusTwo = parseFloat(item.tplus2Proj) || 0;
                return {
                    tplus1Proj: total.tplus1Proj + plusOne,
                    tplus2Proj: total.tplus2Proj + plusTwo,
                };
            },
            { tplus1Proj: 0, tplus2Proj: 0 }
        );
    };

    const calculateGap = (subTotalA: any, subTotalB: any) => {
        return {
            tplus1Proj:
                (parseFloat(subTotalA.tplus1Proj) || 0) -
                (parseFloat(subTotalB.tplus1Proj) || 0),
            tplus2Proj:
                (parseFloat(subTotalA.tplus2Proj) || 0) -
                (parseFloat(subTotalB.tplus2Proj) || 0),
        };
    };

    const loginData: any = Cookies.get("user") || null;
    const loginCookiesData: any = JSON.parse(loginData);

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

    return (
        <>
            {
                !transactionData ? <Notification /> :
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
                                        (item: any) => item?.sectionId === "15" && item?.subSectionId === "04"
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
                        <div className="wrap-accordian custome-form">
                            <ConfirmationAlertDialog
                                id={applId}
                                type={4}
                                open={openConfirmation}
                                handleClose={handleCloseConfirmation}
                                values={formData}
                                handleDelete={handleSubmitConfirmation} />

                            <Formik
                                initialValues={initialValues}
                                onSubmit={handleSubmit}
                                validateOnChange={true}
                                validationSchema={validationSchema}
                                validate={(values) => {
                                    const newValues = { ...values };
                                    let subTotalA: any = { tplus1Proj: "0", tplus2Proj: "0" };
                                    let subTotalB: any = { tplus1Proj: "0", tplus2Proj: "0" };

                                    values?.rows?.forEach((row: any, index: any) => {
                                        if (row.particulars.includes("Sub Total [A]")) {
                                            const rowsAboveA = values.rows.slice(1, index);
                                            subTotalA = calculateSubtotal(rowsAboveA);
                                            newValues.rows[index].tplus1Proj = subTotalA.tplus1Proj.toFixed(2);
                                            newValues.rows[index].tplus2Proj = subTotalA.tplus2Proj.toFixed(2);
                                        } else if (row.particulars.includes("Sub-total [B]")) {
                                            const rowsAboveB = values.rows.slice(5, index);
                                            subTotalB = calculateSubtotal(rowsAboveB);
                                            newValues.rows[index].tplus1Proj = subTotalB.tplus1Proj.toFixed(2);
                                            newValues.rows[index].tplus2Proj = subTotalB.tplus2Proj.toFixed(2);
                                        } else if (row.particulars.includes("Fund required [Gap]")) {
                                            const rowsAboveA = values.rows.slice(1, 4);
                                            subTotalA = calculateSubtotal(rowsAboveA);
                                            const rowsAboveB = values.rows.slice(5, 8);
                                            subTotalB = calculateSubtotal(rowsAboveB);
                                            const { tplus1Proj, tplus2Proj } = calculateGap(subTotalA, subTotalB);
                                            newValues.rows[index].tplus1Proj = tplus1Proj.toFixed(2);
                                            newValues.rows[index].tplus2Proj = tplus2Proj.toFixed(2);
                                        } else if (row.particulars.includes("Total Fund required:")) {
                                            const subTotalARow = values.rows.find((r: { particulars: string | string[]; }) => r.particulars.includes("Sub Total [A]"));
                                            const subTotalBRow = values.rows.find((r: { particulars: string | string[]; }) => r.particulars.includes("Sub-total [B]"));

                                            const tplus1Proj =
                                                (parseFloat(subTotalARow?.tplus1Proj || "0") + parseFloat(subTotalBRow?.tplus1Proj || "0")).toFixed(2);
                                            const tplus2Proj =
                                                (parseFloat(subTotalARow?.tplus2Proj || "0") + parseFloat(subTotalBRow?.tplus2Proj || "0")).toFixed(2);

                                            newValues.rows[index].tplus1Proj = tplus1Proj;
                                            newValues.rows[index].tplus2Proj = tplus2Proj;
                                        }
                                    });

                                    return {};
                                }}
                                validateOnBlur={false}
                                enableReinitialize={true}
                            >
                                {({ values }) => (
                                    <Form>
                                        <fieldset disabled={values?.rows?.[0]?.saveStatus === "02"}>
                                            {values?.rows?.[0]?.saveStatus !== "02" && (
                                                <AutoSave debounceMs={5000} values={values} onSubmit={handleSubmit} />
                                            )}
                                            <div className="wrap-inner-table">
                                                <Table>
                                                    <TableBody>
                                                        <TableRow sx={{ backgroundColor: "rgb(244, 244, 244)" }}>
                                                            <TableCell>
                                                                <strong>Particulars</strong>
                                                            </TableCell>
                                                            <TableCell sx={{ minWidth: 300 }}>
                                                                <strong>Projections for FY {transactionData?.lstAudYrTp1 || "FY-T+1"}</strong>
                                                            </TableCell>
                                                            <TableCell sx={{ minWidth: 400 }}>
                                                                <strong>Projections for FY  {transactionData?.lstAudYrTp2 || "FY-T+2"}</strong>
                                                            </TableCell>
                                                        </TableRow>

                                                        <FieldArray name="rows">
                                                            {() =>
                                                                values?.rows?.map((row: any, index: number) => (
                                                                    <TableRow key={`row-${index}`}>
                                                                        <TableCell>{row.particulars}</TableCell>
                                                                        <TableCell sx={{ minWidth: 300 }}>
                                                                            <FormControl fullWidth>
                                                                                <TextBoxField
                                                                                    label=""
                                                                                    name={`rows.${index}.tplus1Proj`}
                                                                                    type="number"
                                                                                    disabled={
                                                                                        row.particulars.includes("Total Fund required:") ||
                                                                                        row.particulars.includes("Sub Total [A]") ||
                                                                                        row.particulars.includes("Sub-total [B]") ||
                                                                                        row.particulars.includes("Fund required [Gap]")
                                                                                    }
                                                                                />
                                                                            </FormControl>
                                                                        </TableCell>
                                                                        <TableCell sx={{ minWidth: 300 }}>
                                                                            <FormControl fullWidth>
                                                                                <TextBoxField
                                                                                    label=""
                                                                                    name={`rows.${index}.tplus2Proj`}
                                                                                    type="number"
                                                                                    disabled={
                                                                                        row.particulars.includes("Total Fund required:") ||
                                                                                        row.particulars.includes("Sub Total [A]") ||
                                                                                        row.particulars.includes("Sub-total [B]") ||
                                                                                        row.particulars.includes("Fund required [Gap]")
                                                                                    }
                                                                                />
                                                                            </FormControl>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            }
                                                        </FieldArray>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            {values?.rows?.[0]?.saveStatus !== "02" &&
                                                <Button className="sbmtBtn psn_btn mt-3 mb-3 ms-3" type='submit'
                                                    onClick={() => handleClickSetAction('01')}
                                                    variant="contained"> Save <CheckCircleOutlineIcon />
                                                </Button>
                                            }
                                            {values?.rows?.[0]?.saveStatus !== "02" &&
                                                <Button className="sbmtBtn sbmtBtn_scn psn_btn mt-3 mb-3 ms-3" type='submit'
                                                    onClick={() => handleClickSetAction('02')}
                                                    variant="contained"> Submit <SaveAsIcon />
                                                </Button>
                                            }
                                        </fieldset>
                                    </Form>
                                )}
                            </Formik>
                        </div>
                        <NbfcSnackbar open={openSnackbar} msg={snackMsg} severity={severity}
                            handleSnackClose={handleSnackClose} submitCall={false} />
                    </>
            }
        </>
    );
};

export default FundingGap;





