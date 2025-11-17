import React, { FC, useEffect, useState } from "react"
import Grid from '@mui/material/Grid';
import { Button, CircularProgress, Typography } from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AiOutlineArrowLeft } from "react-icons/ai";
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BorrowingForm from "../application-form/capitalResourceProfile/BorrowingForm";
import EquityReserveForm from "../application-form/capitalResourceProfile/EquityReserveForm";
import EquityInfusionForm from "../application-form/capitalResourceProfile/EquityInfusionForm";
import LenderLimitOdForm from "../application-form/capitalResourceProfile/LenderLimitOdForm";
import LenderTermLoanForm from "../application-form/capitalResourceProfile/LenderTermLoanForm";
import { setApplId, setEligibleToSign, setSchemeCode } from "../../features/user/userSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SimCardDownloadIcon from '@mui/icons-material/SimCardDownload';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { DocumentAPI } from "../../features/application-form/documentUpload";
import { OnlineSnackbar } from "../../components/shared/OnlineSnackbar";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, UPLOADINGTEXT } from "../../utlis/constants";
import FullScreenLoader from "../../components/common/FullScreenLoader";
import NotificationAlertBell from "../../components/DrawerComponent/NotificationAlertBell";

const CapitalResourceProfile: FC = () => {
    const [expanded, setExpanded] = React.useState("");
    const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
    const [snackMsg, setSnackMsg] = useState<any>("");
    const [severity, setSeverity] = useState<string | any>("success");
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const { userData, schemeCode, opensections } = useAppSelector((state: any) => state.userStore);
    const [openSectionsData, setOpenSectionsData] = React.useState<any[] | undefined>([]);
    const location = useLocation();
    const receivedData = location.state;

    const [excelData, setExcelData] = useState<any>({
        lenderTl: [],
        lenderOd: [],
    });
    const [excelUploadError, setExcelUploadError] = useState<string | null>(null);

    const onOpenChange =
        (panel: any) => (event: React.SyntheticEvent, isExpanded: any) => {
            setExpanded(isExpanded ? panel : false);
        };

    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const handleNavigate = (e: any) => {
        e.preventDefault();

        if (window.location.pathname === "/refinance/online-dashboard") {
            localStorage.removeItem('applId');
        }
        dispatch(setApplId(""));
        dispatch(setSchemeCode(""));
        dispatch(setEligibleToSign(""));
        navigate("/refinance/online-dashboard");
    };

    const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setExcelUploadError(null);
            setIsUploading(true);

            const file = event.target.files?.[0];
            if (!file) return;

            if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
                setExcelUploadError("Please upload a valid Excel file (.xlsx or .xls)");
                return;
            }
            //Check file size
            if (file.size > MAX_FILE_SIZE_BYTES) {
                setExcelUploadError(`File size should not exceed ${MAX_FILE_SIZE_MB} MB`);
                return;
            }

            const buffer = await file.arrayBuffer();
            const workbookExcelJS = new ExcelJS.Workbook();
            await workbookExcelJS.xlsx.load(buffer);

            const lenderTlSheet = workbookExcelJS.worksheets[1];
            const lenderOdSheet = workbookExcelJS.worksheets[2];
            const lenderMasterSheet = workbookExcelJS.worksheets[3];
            console.log("lenderMasterSheet",lenderMasterSheet);
            if (!lenderTlSheet) {
                throw new Error("Lender TL sheet not found in the Excel file.");
            }
            if (!lenderOdSheet) {
                throw new Error("Lender OD sheet not found in the Excel file.");
            }

            const parseSheetDataExcelJS = (worksheet: ExcelJS.Worksheet) => {
                const jsonData: any[] = [];
                worksheet.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
                    jsonData.push(row.values);
                });
                let jsonArr = jsonData.slice(2);
                return jsonData.slice(2);
            };
            const lenderTlData = parseSheetDataExcelJS(lenderTlSheet);
            const lenderOdData = parseSheetDataExcelJS(lenderOdSheet);
            setExcelData({
                lenderTl: lenderTlData,
                lenderOd: lenderOdData,
            });

            // setTimeout(() => {
            //     setIsUploading(false);
            //     // setOpenSnackbar(true);
            //     // setSeverity("error");
            //     // setSnackMsg("Please ensure the uploaded excel shall follow the validation which are been provided in the sheet 1 of the sample format");
            //     setExcelUploadError("Please ensure the uploaded excel shall follow the validation which are been provided in the sheet 1 of the sample format");
            // }, 60000);

            setIsUploading(false);
            setOpenSnackbar(true);
            setSeverity("success");
            setSnackMsg("Excel file uploaded successfully");

        } catch (error: any) {
            console.error("Excel upload error:", error);
            setExcelUploadError(error.message || "Error parsing Excel file");
            setOpenSnackbar(true);
            setIsUploading(false);
            setSeverity("error");
            setSnackMsg("Error processing Excel file. Please check the format.");
        }
        finally {
            setIsUploading(false); // Always turn off the loader
            if (event.target) event.target.value = "";
        }
    };

    const handleExternalDownload = async () => {
        try {
            const response = await DocumentAPI.downloadExternalTemplate('09', schemeCode);
            const downloadLink = document.createElement('a');
            const type:any=response?.headers?.filetype;
            downloadLink.href = URL.createObjectURL(new Blob([response.data]));
            downloadLink.download = `Capital_Resource_Template.${type}`;
            downloadLink.target = '_blank';
            downloadLink.click();
        } catch (error: any) {
            setOpenSnackbar(true);
            setSeverity("error");
            setSnackMsg('Failed to download template document.');
        }
    };

    useEffect(() => {
        if (opensections && opensections.length > 0) {
            setOpenSectionsData(opensections);
        }
    }, [])

    React.useEffect(() => {
        const panelMap: any = {
            "01": "panel1",
            "02": "panel2",
            "03": "panel3",
            "04": "panel4",
            "05": "panel5",
        };

        const panelToExpand = panelMap[receivedData?.subSectionId];
        if (panelToExpand) {
            setExpanded(panelToExpand);
        }
    }, [receivedData]);


    // if (isUploading) return <div className="CrclProg"><CircularProgress /></div>;
    if (isUploading) return <FullScreenLoader open={isUploading} setOpenModal={setIsUploading} text={UPLOADINGTEXT} />;

    return (
        <div className="wrap-appraisal-area">
            <div className="wrap-accordian">
                <div className="wrap-tabs">

                    <Grid className="top-header-container" container spacing={1} style={{ zIndex: '9', position: 'relative' }}>
                        <Grid className="pb-2" item xs={7}>
                            <Typography
                                className="wrap-bold"
                                noWrap
                                variant="subtitle1"
                                component="div"
                            >
                                <h6 className="title">Capital & Resource Profile</h6>
                            </Typography>
                        </Grid>
                        <Grid
                            className="pb-2"
                            item
                            xs={5}
                            display="flex"
                            justifyContent="end"
                        >
                            <Link className="in-clickable text-capitalize" to="/refinance/online-dashboard">
                                <Button
                                    color="inherit"
                                    className="text-capitalize"
                                    variant="outlined"
                                    size="small"
                                    onClick={handleNavigate}
                                >
                                    <AiOutlineArrowLeft className="me-2" /> Back
                                </Button>
                            </Link>
                        </Grid>
                    </Grid>

                    <div className="up_btns">
                        <input
                            accept=".xlsx, .xls"
                            id="excel-upload-button"
                            type="file"
                            onChange={handleExcelUpload}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="excel-upload-button">
                            <Button
                                variant="contained"
                                color="primary"
                                component="span"
                                disabled={isUploading} // <-- Disable button while uploading
                                style={{ marginLeft: '0px', padding: '4px 10px', textTransform: 'capitalize' }}
                                startIcon={isUploading ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon style={{ fontSize: '20px' }} />}
                            >
                                {isUploading ? "Uploading..." : "Upload Excel"}
                            </Button>
                        </label>

                        <Button
                            variant="contained"
                            color="primary"
                            className="sbmtBtn dwldBtn"
                            style={{ marginLeft: '10px' }}
                            onClick={handleExternalDownload}
                        >
                            Download Sample <SimCardDownloadIcon />
                        </Button>
                    </div>
                    {excelUploadError && (
                        <div className="error-message mt-1 text-danger">
                            {excelUploadError}
                        </div>
                    )}

                    <div className="form-container mt-1">
                        <Accordion className='custome-accordian' expanded={expanded === 'panel1'} onChange={onOpenChange('panel1')}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                aria-controls="panel1-content"
                                id="panel1-header"
                            >
                                <div className="icnAlrt">
                                    <div> Borrowing Cost details</div>
                                    {openSectionsData && openSectionsData.length > 0 && (() => {
                                        const matchedItem = openSectionsData.find(
                                            (item: any) => item?.sectionId === "09" && item?.subSectionId === "01"
                                        );
                                        return matchedItem ? (
                                            <NotificationAlertBell />
                                        ) : null;
                                    })()}
                                </div>
                            </AccordionSummary>
                            <AccordionDetails>
                                <div className="form-container">
                                    <BorrowingForm openSectionsData={openSectionsData} />
                                </div>
                            </AccordionDetails>
                        </Accordion>
                        <Accordion className='custome-accordian' expanded={expanded === 'panel2'} onChange={onOpenChange('panel2')}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                aria-controls="panel2-content"
                                id="panel1-header">
                                <div className="icnAlrt">
                                    <div>Details of Lenders - TL</div>
                                    {openSectionsData && openSectionsData.length > 0 && (() => {
                                        const matchedItem = openSectionsData.find(
                                            (item: any) => item?.sectionId === "09" && item?.subSectionId === "02"
                                        );
                                        return matchedItem ? (
                                            <NotificationAlertBell />
                                        ) : null;
                                    })()}
                                </div>
                                {/*excelData={excelData} openSectionsData={openSectionsData */}
                            </AccordionSummary>
                            <AccordionDetails>
                                <div className="form-container">
                                    <LenderTermLoanForm excelData={excelData?.lenderTl} openSectionsData={openSectionsData} />
                                </div>
                            </AccordionDetails>
                        </Accordion>
                        <Accordion className='custome-accordian' expanded={expanded === 'panel3'} onChange={onOpenChange('panel3')}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                aria-controls="panel3-content"
                                id="panel1-header">
                                <div className="icnAlrt">
                                    <div> Details of Lenders -  CC/WC/OD</div>
                                    {openSectionsData && openSectionsData.length > 0 && (() => {
                                        const matchedItem = openSectionsData.find(
                                            (item: any) => item?.sectionId === "09" && item?.subSectionId === "03"
                                        );
                                        return matchedItem ? (
                                           <NotificationAlertBell />
                                        ) : null;
                                    })()}
                                </div>
                            </AccordionSummary>
                            <AccordionDetails>
                                <div className="form-container">
                                    <LenderLimitOdForm excelData={excelData?.lenderOd} openSectionsData={openSectionsData} />
                                </div>
                            </AccordionDetails>
                        </Accordion>
                        <Accordion className='custome-accordian' expanded={expanded === 'panel4'} onChange={onOpenChange('panel4')}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                aria-controls="panel4-content"
                                id="panel1-header"
                            >
                                <div className="icnAlrt">
                                    <div>Details of Equity and reserves</div>
                                    {/* {openSectionsData && openSectionsData.length > 0 && (() => {
                                        const matchedItem = openSectionsData.find(
                                            (item: any) => item?.sectionId === "09" && item?.subSectionId === "04"
                                        );
                                        return matchedItem ? (<NotificationAlertBell />) : null;
                                    })()} */}
                                </div>
                            </AccordionSummary>
                            <AccordionDetails>
                                <div className="form-container">
                                    <EquityReserveForm openSectionsData={openSectionsData} />
                                </div>
                            </AccordionDetails>
                        </Accordion>
                        <Accordion className='custome-accordian' expanded={expanded === 'panel5'} onChange={onOpenChange('panel5')}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                aria-controls="panel5-content"
                                id="panel1-header">
                                <div className="icnAlrt">
                                    <div> Equity Infusion Details</div>
                                    {openSectionsData && openSectionsData.length > 0 && (() => {
                                        const matchedItem = openSectionsData.find(
                                            (item: any) => item?.sectionId === "09" && item?.subSectionId === "05"
                                        );
                                        return matchedItem ? (
                                            <NotificationAlertBell />
                                        ) : null;
                                    })()}
                                </div>
                            </AccordionSummary>
                            <AccordionDetails>
                                <div className="form-container">
                                    <EquityInfusionForm openSectionsData={openSectionsData} />
                                </div>
                            </AccordionDetails>
                        </Accordion>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CapitalResourceProfile;
