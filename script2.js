import * as React from 'react';
import {
  Grid,
  Typography,
  Box,
  Button,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  LinearProgress,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import axios from 'axios';
import { useAppSelector } from '../../app/hooks';
import { useUpdateLeadMutation, useGetLeadQuery } from '../../slices/leadSlice';
import useToken from '../../Features/Authentication/useToken';

interface DueDiligenceProps {
  onSave?: () => void;
  leadId?: number | string;
}

const DueDiligence = React.forwardRef<any, DueDiligenceProps>(({ onSave, leadId: propLeadId }, ref) => {
  const { data: leadData } = useGetLeadQuery(+propLeadId || 0, { skip: !propLeadId });
  const [updateLead, { isLoading: isSaving }] = useUpdateLeadMutation();
  const { getToken } = useToken();

  const leadId = propLeadId || leadData?.id; // fallback

  const [comment, setComment] = React.useState<string>('');
  const [downloadProgress, setDownloadProgress] = React.useState<number>(0);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState('');
  const [snackbarSeverity, setSnackbarSeverity] = React.useState<'success' | 'error'>('success');

  React.useEffect(() => {
    if (leadData?.legalEntity?.dueDiligenceComment) {
      setComment(leadData.legalEntity.dueDiligenceComment);
    }
  }, [leadData]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setComment(e.target.value);
  };

  const handleSave = async () => {
    if (!leadId) {
      setSnackbarMessage('Lead ID is missing');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      const patchPayload = {
        id: leadId,
        legalEntity: {
          ...(leadData?.legalEntity || {}),
          dueDiligenceComment: comment.trim(),
        },
      };

      await updateLead(patchPayload).unwrap();

      setSnackbarMessage('Due Diligence remarks saved successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      if (onSave) onSave();
    } catch (err: any) {
      setSnackbarMessage(err?.data?.message || 'Failed to save remarks');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleDownload = async () => {
    if (!leadId) {
      setSnackbarMessage('Lead ID is missing');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const token = getToken();

      const response = await axios({
        method: 'GET',
        url: `${process.env.REACT_APP_API_ENDPOINT}/dueDeligenceZip?leids=${leadId}`,
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadProgress(percent);
          }
        },
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `due-diligence-lead-${leadId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSnackbarMessage('Due Diligence files downloaded successfully');
      setSnackbarSeverity('success');
    } catch (err: any) {
      const msg =
        err?.response?.status === 404
          ? 'No due diligence files found for this lead'
          : err?.message || 'Download failed';
      setSnackbarMessage(msg);
      setSnackbarSeverity('error');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = () => setSnackbarOpen(false);

  return (
    <Paper
      elevation={2}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        backgroundColor: '#ffffff',
        position: 'relative',
      }}
    >
      {/* Header with Download Button */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          pb: 2,
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={600} color="text.primary">
            Due Diligence Remarks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Observations, findings, red flags or key notes from due diligence
          </Typography>
        </Box>

        <Tooltip title="Download all Due Diligence documents (ZIP)">
          <Button
            variant="outlined"
            color="primary"
            startIcon={
              isDownloading ? <CircularProgress size={20} color="primary" /> : <DownloadIcon />
            }
            onClick={handleDownload}
            disabled={isDownloading || !leadId}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              minWidth: 180,
            }}
          >
            {isDownloading ? 'Downloading...' : 'Download Files'}
          </Button>
        </Tooltip>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            label="Due Diligence Comments / Key Observations"
            multiline
            rows={7}
            fullWidth
            variant="outlined"
            value={comment}
            onChange={handleCommentChange}
            placeholder="Enter important findings, discrepancies, legal observations, site visit notes, etc..."
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fafafa',
                borderRadius: 2,
              },
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={isSaving || !comment.trim()}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                px: 4,
                py: 1.2,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(25, 118, 210, 0.25)',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(25, 118, 210, 0.35)',
                },
              }}
            >
              {isSaving ? 'Saving...' : 'Save Remarks'}
            </Button>
          </Box>
        </Grid>

        {isDownloading && downloadProgress > 0 && (
          <Grid item xs={12}>
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={downloadProgress} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 1.5, fontWeight: 500 }}>
                {downloadProgress}% — Preparing ZIP file...
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
});

export default DueDiligence;













import TitleHeader from "../../Components/titleheader";
import * as React from 'react';
import { 
  Box, 
  Grid, 
  Container, 
  Typography, AccordionDetails, Slide, CircularProgress, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Button,
  Stack,
  Paper,
} from "@mui/material";
import { styled } from '@mui/material/styles';
import Section from "../../Components/Framework/Section";
import "../../assets/css/common.css";
import { useCallback, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  setLeadId,
} from "../../slices/localStores/leadStore";
import { useAppDispatch } from "../../app/hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  SubmitableForm,
} from "../../Components/Framework/FormSubmit";
import FacilityLoanDetails from "./FacilityLoanDetails";
import NbfcDetailsCredit from "./NbfcDetailsCredit";
import SidbiShareCredit from "./SidbiShareCredit";
import KmpDocumentsCredit from "./KmpDocumentsCredit";
import LegalEntityInformation from "./LegalEntityInformation";
import AccordionCss from "../../Components/Framework/AccordionCss";
import AccordionSummaryCss from "../../Components/Framework/AccordionSummaryCss";
import { ReactComponent as PlusIcon } from '../../assets/icons/plus.svg';
import { ReactComponent as MinusIcon } from '../../assets/icons/minus.svg';
import ApplicantInfo from "./ApplicantInfo";
import TableWithoutPaginationRemarks from "./TableWithoutPaginationRemarks";
import { RequestWithParentId, SearchRequest } from "../../models/baseModels";
import { Remark } from "../../models/remark";
import { useListRemarksQuery } from "../../slices/remarksSlice";
import BlueButton from "../../Components/Framework/BlueButton";
import { useGetLeadQuery, useUpdateLeadMutation } from "../../slices/leadSlice";
import { skipToken } from "@reduxjs/toolkit/dist/query";
import AlertSuccessWithoutClose from "../../Components/Framework/AlertSuccessWithoutClose";
import AlertBlueWithoutClose from "../../Components/Framework/AlertBlueWithoutClose";
import WhiteOutlinedWithBlueButton from "../../Components/Framework/WhiteOutlinedWithBlueButton";
import BreGoDisplay from "../L0/BreGoDisplay";
import RepaymentScheduleAccordion from "./RepaymentScheduleAccordion";
import RepaymentScheduleSidbiAccordion from "./RepaymentScheduleSidbiAccordion";
import RepaymentScheduleAmbitAccordion from "./RepaymentScheduleAmbitAccordion";
import { useUploadKycMutation } from "../../slices/integrationSlice";
import CreditAssessmentMemoPdfButton from  './CreditAssessmentMemoPdfButton';
import { ReactComponent as SpinningDotsWhite } from "../../assets/icons/spinning_dots_white.svg";
import { Rps } from "../../models/rps";
import { useListRpsOverallQuery, useListRpsSidbiQuery, useListRpsAmbitQuery } from "../../slices/rpsListSlice";
import CloseIcon from "@mui/icons-material/Close";
import SuccessAnimation from "../../Components/Framework/SuccessAnimation";

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import jsPDF from 'jspdf';
import useToken from "../Authentication/useToken";
import Textarea from "@mui/joy/Textarea";
// import { documentDefinition } from "../pdf/CreditAssessmentMemo";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

const SpeedometerWhiteIcon = require("../../assets/icons/speedometer_white.svg").default;
const PrintIcon = require("../../assets/icons/printing.svg").default;
const RightArrowIcon = require("../../assets/icons/rightarrowgrey.svg").default;
const CheckmarkWhiteIcon = require("../../assets/icons/checkmarkwhite.svg").default;

interface ExpandedState {
  [key: string]: boolean;
}

const AccordionDetailsCss = styled(AccordionDetails)(() => ({
  padding: '0px !important',
}));

const useStyles = makeStyles((theme) => ({
  browsefilediv: {
    "& > *": {
      margin: theme.spacing(1),
      color: "#A9A9A9 !important",
    },

    "& .MuiButtonBase-root": {
      "&hover": {
        color: "#FFFFFF",
      },
      "&focus": {
        color: "#FFFFFF",
      },
    },
    display: "flex",
    alignItems: "center",
    border: "1px solid #C0C0C0",
    maxHeight: "52px",
  },
  input: {
    display: "none",
  },
  root: {
    backgroundColor: "#F5F5F5 !important",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px",
  },
}));

const CreditAssessmentMemo = React.forwardRef<SubmitableForm, {}>(() => {
  const classes = useStyles();
  const { id: leadId } = useParams();
  const { data: lead } = useGetLeadQuery(Number(leadId) || skipToken);
  const dispatch = useAppDispatch();

  const { getName, getRoles} = useToken();
  const roles = getRoles();

  const [updateLeadStatus] = useUpdateLeadMutation();
  const [uploadKyc] = useUploadKycMutation();

  const setLeadIdRef = useCallback(
    (id: number) => dispatch(setLeadId(id)),
    [dispatch]
  );
  useEffect(() => {
    if (leadId) setLeadIdRef(Number(leadId));
    if(lead !== undefined){
      if(roles && roles.length > 0 && roles[0] === "NBFC"){
        navigate("/restricted");
      }
      if(roles && roles.length > 0 && roles[0] === "MAKER"){
        if(lead?.sidbiStatus !== "BUSINESS_RULES" && leadSubmitted === false) {
          navigate("/restricted");
        }
      }
      if(roles && roles.length > 0 && roles[0] === "CHECKER") {
        if(lead?.sidbiStatus !== "MAKER_APPROVED" && lead?.sidbiStatus !== "CHECKER_APPROVED") {
          navigate("/restricted");
        }
      }
    }
  }, [leadId, setLeadIdRef, lead]);

  const navigate = useNavigate();

  const buttons = [
    {
      label: "Back to Application Details",
      buttonstyle: "secondary_outline",
      icon: RightArrowIcon,
      action: () => {
        localStorage.setItem('CreditAssessmentMemoSuccess', 'true');
        navigate(`/l1/queuetracker/${leadId}`); // Send the state
      },
    },
    {
      label: "Credit Vetting Completed",
      buttonstyle: "blue",
      icon: SpeedometerWhiteIcon,
      action: () => {
        localStorage.setItem('CreditAssessmentMemoSuccess', 'true');
        navigate(`/l1/queuetracker/${leadId}`); // Send the state
      },
      css: { marginLeft: "12px" }
    },
    {
      label: "Print",
      buttonstyle: "white_outlined_with_blue",
      icon: PrintIcon,
      action: () => { console.log('print'); },
      css: { marginLeft: "12px" }
    },
  ];

  const breadcrumbs = [
    <Link key="1" color="#A9A9A9" to="/">
      Queue Tracker
    </Link>,
    <Link key="1" color="#A9A9A9" to={`/l1/queuetracker/${leadId}`}>
      Application Queue
    </Link>,
    <Link key="1" color="#A9A9A9" to={`/l1/queuetracker/${leadId}`}>
      Application Details
    </Link>,
    <Link key="1" color="#A9A9A9" to={`/l1/queuetracker/${leadId}`}>
      Credit Assessment Memo
    </Link>,
  ];



  interface ColumnRemarks {
    id: 'touchedAt' | 'username' | 'notes' | 'status';
    label: string;
    align?: 'left' | 'right' | 'center'; // Adjust the alignment values as per your requirement
    width?: string; // Adjust the width type as per your requirement
  }

  const columnsRemarks: readonly ColumnRemarks[] = [{ id: 'touchedAt', label: 'DATE & TIME', width: '40%' }, { id: 'username', label: 'USERNAME', width: '20%' }, { id: 'notes', label: 'REMARKS', width: '20%' }, { id: 'status', label: 'STATUS', width: '20%', align: 'center' }];

  const remarksInput: RequestWithParentId<SearchRequest<Remark>> = {
    parentId: Number(leadId) || 0,
    requestValue: {
      orderBy: {
        id: "DESC"
      }
    },
  };

  const { data: rows_product_segmentRemarks } = useListRemarksQuery(remarksInput);

  const [expanded, setExpanded] = React.useState<ExpandedState>({ panel_bre: true });
  const [showApproveCommentsModal, setShowApproveCommentsModal] = React.useState(false);
  const [remarkAction, setRemarkAction] = React.useState("");
  const [remark, setRemark] = React.useState("");
  const [leadSubmitted, setLeadSubmitted] = React.useState(false);
  const [leadSubmittedText, setLeadSubmittedText] = React.useState("");

  const handleChange = (panel: string) => (event: React.ChangeEvent<{}>, isExpanded: boolean) => {
    setExpanded((prev) => ({ ...prev, [panel]: isExpanded }));
  };
  
  const [loadingPDF, setLoadingPDF] = React.useState(false);
  const [loadingButton, setLoadingButton] = React.useState(false);
  const [loadingModalButton, setLoadingModalButton] = React.useState(false);

  const generatePDF = async () => {

    setLoadingPDF(true);
    const element = document.getElementsByClassName('custom_scroll')[0] as HTMLElement;
   
    if (element) {
      const pdf = new jsPDF('p', 'pt', 'a4');
      // Get page dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      // Define margins
      const marginLeft = pageWidth * 0.05;
      const marginRight = pageWidth * 0.07;
      const marginTopBottom = pageHeight * 0.05;
   
      // Reset element height to "auto" to avoid cutoff
      element.style.height = 'auto';
   
      await pdf.html(element, {
        callback: function (doc) {
          doc.save('Credit Assessment Memo - ' + lead?.entityName + '.pdf');
          setLoadingPDF(false);
        },
        x: marginLeft,
        y: marginTopBottom,
        margin: [20, 0, 20, 0],
        html2canvas: {
          scale: 0.64, // Adjust scale if needed
          backgroundColor: "#ffffff",
          windowWidth: element.scrollWidth, // Capture the full width
        },
        autoPaging: true, // Automatically add pages
      });
    } else {
      console.error("Element 'custom_scroll' not found");
    }
  };

  const rpsInput: RequestWithParentId<SearchRequest<Rps>> = {
    parentId: Number(leadId) || 0,   // assuming you have leadId in this component
    requestValue: {},
  };
   
  const { data: rpsDataConsolidated } = useListRpsOverallQuery(rpsInput);
	const { data: rpsDataSidbi } = useListRpsSidbiQuery(rpsInput);
	const { data: rpsDataNbfc } = useListRpsAmbitQuery(rpsInput);

  return (
    <>
    {leadSubmitted ? (
      <React.Fragment>
        <Grid
          item
          xs={12}
          sm={8}
          md={6}
          component={Paper}
          elevation={6}
          square
          className={classes.root}
          spacing={0}
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <Box className="login_formBox">
            <SuccessAnimation />
            <Typography
              variant="h5"
              gutterBottom
              style={{
                marginBottom: "0px",
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              You have successfully
              <br />{leadSubmittedText}{" "}
              <span style={{ color: "#1377FF" }}>#{leadId}</span>
            </Typography>
            {leadSubmittedText !== "approved this application as Checker" ?
            <Box component="form" noValidate className="loginformBox">
              <Grid
                container
                className="login_forgot_password_grid"
                justifyContent="center"
                alignItems="center"
                sx={{ textAlign: "center", mt: "24px" }}
              >
                <Grid
                  item
                  xs={12}
                  sm={12}
                  md={10}
                  lg={10}
                  xl={12}
                  className="text-right"
                >
                  <Button component={Link} {...{
                    to: "/",
                    className: "no-underline login_forgot_password",
                    style: {
                      textDecoration: "none",
                      color: "#A9A9A9",
                      fontSize: "14px",
                    }
                  } as any}>
                    {"< Back to Dashboard"}
                  </Button>
                </Grid>
              </Grid>
            </Box>
            : <></>}
          </Box>
        </Grid>
      </React.Fragment>
    ) : (
    <div style={{ marginTop: "2.5em", marginBottom: "2.5em" }}>
      <Container maxWidth="xl">
        <div>
          <TitleHeader
            title="Credit Assessment Memo"
            breadcrumbs={breadcrumbs}
            button={buttons}
          />
        </div>

        <div style={{ marginTop: "1.5em" }}>
          <Box sx={{ width: "100%" }}>
            <Grid container spacing={3}>
              <Grid item xl={3} lg={3.5} md={4} xs={4}>
                <ApplicantInfo />
                {localStorage.getItem("alertCustomerNTBAfterApplicantInfo") && (
                  <div id="alert-div" style={{ marginTop: "16px" }}>
                    <Slide
                      in={true}
                      direction="down"
                      mountOnEnter
                      unmountOnExit
                    >
                      <AlertSuccessWithoutClose
                        icon={false}
                        severity="success"
                      >
                        Customer is NTB, Customer ID is not yet available
                      </AlertSuccessWithoutClose>
                    </Slide>
                  </div>
                )}
                {localStorage.getItem("alertCreditAssessmentCompleted") && (
                  <div id="alert-div" style={{ marginTop: "16px" }}>
                    <Slide
                      in={true}
                      direction="down"
                      mountOnEnter
                      unmountOnExit
                    >
                      <AlertBlueWithoutClose
                        icon={false}
                        severity="success"
                      >
                        Credit Assessment completed
                      </AlertBlueWithoutClose>
                    </Slide>
                  </div>
                )}
              </Grid>

              <Grid item xl={9} lg={8.5} md={8} xs={8}>
                <Grid container spacing={0} padding={0}>
                  <Grid item xs={12} sx={{ textAlign: "right" , marginBottom: "10px" }}>
                    {/* <CreditAssessmentMemoPdfButton /> */}
                    <WhiteOutlinedWithBlueButton
                        key={"Print CAM"}
                        variant="contained"
                        startIcon={loadingPDF ? <CircularProgress size={14} /> : <img src={PrintIcon} alt="Print Icon" />}
                        // onClick={() => { console.log('print test'); }}
                        onClick={generatePDF}
                    >
                        Print CAM
                    </WhiteOutlinedWithBlueButton>
                  </Grid>
                </Grid>
                <div className="custom_scroll" style={{color: "#3B415B"}}>
                  <LegalEntityInformation />
                  <FacilityLoanDetails />
                  <NbfcDetailsCredit />
                  <SidbiShareCredit />
                  <KmpDocumentsCredit />

                  <Section sx={{ width: '100%', mt: '24px' }}>
                    <Grid container spacing={0} padding={0}>
                      <Grid item xs={12}>
                        <AccordionCss expanded={expanded['panel_bre']} onChange={handleChange('panel_bre')}>
                          <AccordionSummaryCss
                            expandIcon={expanded['panel_bre'] ? <MinusIcon /> : <PlusIcon />}
                            aria-controls="panel_bre-content"
                            id="panel_bre-header"
                          >
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#3B415B" }}>BRE</Typography>
                          </AccordionSummaryCss>
                          <AccordionDetailsCss>
                            <Grid container spacing={0} padding={0}>
                              <BreGoDisplay/>
                            </Grid>
                          </AccordionDetailsCss>
                        </AccordionCss>
                      </Grid>
                    </Grid>
                  </Section>

                  {rpsDataConsolidated && rpsDataConsolidated.length > 0 && (
                    <Section sx={{ width: '100%', mt: '24px' }}>
                      <Grid container spacing={0} padding={0}>
                        <Grid item xs={12}>
                          <AccordionCss
                            expanded={expanded['panel_bre']}
                            onChange={handleChange('panel_bre')}
                          >
                            <AccordionSummaryCss
                              expandIcon={expanded['panel_bre'] ? <MinusIcon /> : <PlusIcon />}
                              aria-controls="panel_bre-content"
                              id="panel_bre-header"
                            >
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 700, color: '#3B415B' }}
                              >
                                Repayment Schedule (Consolidated)
                              </Typography>
                            </AccordionSummaryCss>
                            <AccordionDetailsCss>
                              <Grid container spacing={0} padding={0}>
                                {/* we’ll pass the data down */}
                                <RepaymentScheduleAccordion data={rpsDataConsolidated} />
                              </Grid>
                            </AccordionDetailsCss>
                          </AccordionCss>
                        </Grid>
                      </Grid>
                    </Section>
                  )}

                  {rpsDataSidbi && rpsDataSidbi.length > 0 && (
                    <Section sx={{ width: '100%', mt: '24px' }}>
                      <Grid container spacing={0} padding={0}>
                        <Grid item xs={12}>
                          <AccordionCss expanded={expanded['panel_bre']} onChange={handleChange('panel_bre')}>
                            <AccordionSummaryCss
                              expandIcon={expanded['panel_bre'] ? <MinusIcon /> : <PlusIcon />}
                              aria-controls="panel_bre-content"
                              id="panel_bre-header"
                            >
                              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#3B415B" }}>Repayment Schedule (SIDBI)</Typography>
                            </AccordionSummaryCss>
                            <AccordionDetailsCss>
                              <Grid container spacing={0} padding={0}>
                                <RepaymentScheduleSidbiAccordion data={rpsDataSidbi} />
                              </Grid>
                            </AccordionDetailsCss>
                          </AccordionCss>
                        </Grid>
                      </Grid>
                    </Section>
                  )}

                  {rpsDataNbfc && rpsDataNbfc.length > 0 && (
                    <Section sx={{ width: '100%', mt: '24px' }}>
                      <Grid container spacing={0} padding={0}>
                        <Grid item xs={12}>
                          <AccordionCss expanded={expanded['panel_bre']} onChange={handleChange('panel_bre')}>
                            <AccordionSummaryCss
                              expandIcon={expanded['panel_bre'] ? <MinusIcon /> : <PlusIcon />}
                              aria-controls="panel_bre-content"
                              id="panel_bre-header"
                            >
                              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#3B415B" }}>Repayment Schedule (Nbfc)</Typography>
                            </AccordionSummaryCss>
                            <AccordionDetailsCss>
                              <Grid container spacing={0} padding={0}>
                                <RepaymentScheduleAmbitAccordion data={rpsDataNbfc} />
                              </Grid>
                            </AccordionDetailsCss>
                          </AccordionCss>
                        </Grid>
                      </Grid>
                    </Section>
                  )}

                  <div style={{ marginTop: 24 }}>
                  <TableWithoutPaginationRemarks
                    rows={rows_product_segmentRemarks?.content}
                    columns={columnsRemarks}
                  />
                  </div>
                </div>
                  {lead?.sidbiStatus === "MAKER_APPROVED" && <Grid container spacing={2} paddingTop={2} paddingBottom={2} alignItems={'center'}>
                    <Grid item xs={12} lg={12} sx={{ textAlign: "right" }}>
                      <BlueButton
                        key={"Approve"}       
                        startIcon={loadingButton === true? <SpinningDotsWhite /> : <img src={CheckmarkWhiteIcon} alt={CheckmarkWhiteIcon} />}
                        disabled={loadingButton}
                        variant="contained"
                        onClick={() => {
                          setRemarkAction('CHECKER_APPROVED');
                          setLoadingButton(true);
                          setShowApproveCommentsModal(true);
                          // updateLeadStatus({ 
                          //   id: Number(leadId), 
                          //   sidbiStatus: "CHECKER_APPROVED",
                          //   bulkEntryId: "NEW",
                          //   remark: "Application is approved by the checker",
                          //   checker: getName(),
                          //   checkerApprovedOn: new Date() }).then(() => {
                          //     uploadKyc(Number(leadId)).then(() => {
                          //       alert("Application is approved by the checker.");
                          //       navigate(`/l1/sanctionletter/${leadId}`)
                          //       setLoadingButton(false);
                          //     })
                          // });
                        }}
                      >
                        Approve
                      </BlueButton> 
                    </Grid>
                  </Grid>}
                  {lead?.sidbiStatus === "BUSINESS_RULES" && <Grid container spacing={2} paddingTop={2} paddingBottom={2} alignItems={'center'}>
                    <Grid item xs={12} lg={12} sx={{ textAlign: "right" }}>
                      <BlueButton
                        key={"Recommended for Approval"}                        
                        startIcon={loadingButton === true? <SpinningDotsWhite /> : <img src={CheckmarkWhiteIcon} alt={CheckmarkWhiteIcon} />}
                        disabled={loadingButton}
                        variant="contained"
                        onClick={() => {
                          setRemarkAction('MAKER_APPROVED');
                          setLoadingButton(true);
                          setShowApproveCommentsModal(true);
                          // updateLeadStatus({ 
                          //   id: Number(leadId), 
                          //   sidbiStatus: "MAKER_APPROVED", 
                          //   remark: "Application is approved by Maker",
                          //   maker: getName(),
                          //   makerApprovedOn: new Date() }).then(() => {
                          //   // uploadKyc(Number(leadId)).then(() => {
                          //   //   alert("Recommended for approval");
                          //   //   navigate(`/`)
                          //   // })     
                          //   navigate(`/`)     
                          //   setLoadingButton(false);
                          // });

                        }}
                      >
                        Recommended for approval
                      </BlueButton>
                    </Grid>
                  </Grid>}
              </Grid>

            </Grid>
          </Box>
        </div>
      </Container>
      <Dialog
          open={showApproveCommentsModal}
          onClose={() => { 
            setShowApproveCommentsModal(false); 
            setLoadingButton(false);
            setLoadingModalButton(false);
          }}
          fullWidth
          maxWidth="xs"
          PaperProps={{
              sx: {
              borderRadius: 3,
              p: 0,
              overflow: "hidden",
              },
          }}
        >
            {/* Close icon */}
            <Box sx={{ position: "absolute", top: 12, right: 12 }}>
                <IconButton
                size="small"
                onClick={() => {
                  setShowApproveCommentsModal(false);
                  setLoadingButton(false);
                  setLoadingModalButton(false);
                }}
                sx={{
                    backgroundColor: "#ffffff",
                    boxShadow: 1,
                    "&:hover": { backgroundColor: "#f5f5f5" },
                    border: "1px solid #9E9E9E",
                    borderRadius: "5px",
                }}
                >
                <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
            
            {/* Content */}
            <Box sx={{ px: 4, pt: 4, pb: 3 }}>
                <Stack spacing={2} alignItems="center">
            
                {/* Title */}
                <DialogTitle
                    sx={{
                    p: 0,
                    textAlign: "center",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    }}
                >
                    Comments
                </DialogTitle>
            
                  <Grid container>
                    <Grid item lg={12} md={12} xs={12}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#3B415B" }}>Please enter a comment and submit</Typography>
                      <Textarea
                        value={remark}
                        onChange={(event) => setRemark(event.target.value)}
                        minRows={10}
                      />
                    </Grid>
                  </Grid>
                </Stack>
            </Box>
            
            {/* Bottom actions bar */}
            <Box
                sx={{
                borderTop: "1px solid #f0f0f0",
                px: 4,
                py: 2.5,
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                backgroundColor: "#f3f3f3"
                }}
            >
                <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  setShowApproveCommentsModal(false);
                  setLoadingButton(false);
                  setLoadingModalButton(false);
                }}
                sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    borderColor: "#e0e0e0",
                    color: "text.primary",
                    "&:hover": {
                    borderColor: "#c2c2c2",
                    backgroundColor: "#fafafa",
                    },
                }}
                >
                Cancel
                </Button>
            
                <Button
                startIcon={loadingModalButton === true && <SpinningDotsWhite />}
                disabled={loadingModalButton}
                variant="contained"
                fullWidth
                onClick={() => {
                  setLoadingModalButton(true);
                 
                  // --- MAKER APPROVED ---
                  if (remarkAction === "MAKER_APPROVED") {
                    updateLeadStatus({
                      id: Number(leadId),
                      sidbiStatus: "MAKER_APPROVED",
                      remark: remark === "" ? "Application is approved by maker" : `${remark} Application is approved by maker`,
                      maker: getName(),
                      makerApprovedOn: new Date(),
                    }).then(() => {
                      // navigate(`/`);
                      setLeadSubmitted(true);
                      setLeadSubmittedText("approved this application as Maker")
                      setLoadingButton(false);
                      setLoadingModalButton(false);
                    });
                 
                    return;
                  }
                 
                  // --- CHECKER APPROVED ---
                  if (remarkAction === "CHECKER_APPROVED") {
                    updateLeadStatus({
                      id: Number(leadId),
                      sidbiStatus: "CHECKER_APPROVED",
                      bulkEntryId: "NEW",
                      remark:
                        remark === ""
                          ? "Application is approved by the checker"
                          : `${remark} Application is approved by the checker`,
                      checker: getName(),
                      checkerApprovedOn: new Date(),
                    }).then(() => {
                      uploadKyc(Number(leadId)).then(() => {
                        setLeadSubmitted(true);
                        setLeadSubmittedText("approved this application as Checker")
                        setLoadingButton(false);
                        setLoadingModalButton(false);
                        setTimeout(() => {
                          setLeadSubmitted(false);
                          setLeadSubmittedText("");
                          navigate(`/l1/sanctionletter/${leadId}`);
                        }, 3000);

                        // alert("Application is approved by the checker.");
                        // navigate(`/l1/sanctionletter/${leadId}`);
                        // setLoadingButton(false);
                        // setLoadingModalButton(false);
                      });
                    });
                 
                    return;
                  }
                }}
                sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    boxShadow: "0 8px 24px rgba(59, 92, 255, 0.35)",
                    backgroundColor: "#1377ff",
                    "&:hover": {
                        color: "#1377ff",
                        backgroundColor: "#fff",
                        border: "1px solid #1377ff",
                        boxShadow: "0 8px 24px rgba(51, 72, 216, 0.4)",
                    },
                }}
                >
                Submit
                </Button>
            </Box>
        </Dialog>
    </div>
      )}
    </>
  );
});


export default CreditAssessmentMemo;


import * as React from 'react';
import {
  Grid,
  Typography,
  Box,
  Button,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  LinearProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import axios from 'axios';
import { useAppSelector } from '../../app/hooks';
import { useUpdateLeadMutation, useGetLeadQuery } from '../../slices/leadSlice';
import useToken from '../../Features/Authentication/useToken'; // ← assuming this exists like in FileUpload

interface DueDiligenceProps {
  onSave?: () => void;
  leadId?:any; // optional – but we prefer from store
}

const DueDiligence = React.forwardRef<any, DueDiligenceProps>(({ onSave,leadId }, ref) => {
  const { data: leadData } = useGetLeadQuery(+leadId || 0, { skip: !leadId });
  const [updateLead, { isLoading: isSaving }] = useUpdateLeadMutation();

  const { getToken } = useToken(); 

  const [comment, setComment] = React.useState<string>('');
  const [downloadProgress, setDownloadProgress] = React.useState<number>(0);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState('');
  const [snackbarSeverity, setSnackbarSeverity] = React.useState<'success' | 'error'>('success');

  // You can sync comment from backend if you store it
  React.useEffect(() => {
    // Uncomment if you decide to persist the comment in backend
    // if (leadData?.legalEntity?.dueDiligenceComment) {
    //   setComment(leadData.legalEntity.dueDiligenceComment);
    // }
  }, [leadData]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setComment(e.target.value);
  };

  const handleSave = async () => {
    if (!leadId) {
      setSnackbarMessage('No lead ID found');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      const patchPayload = {
        id: leadId,
        legalEntity: {
          ...(leadData?.legalEntity || {}),
          dueDiligenceComment: comment.trim(),
        },
      };

      await updateLead(patchPayload).unwrap();

      setSnackbarMessage('Due Diligence comment saved successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      if (onSave) onSave();
    } catch (err: any) {
      console.error('Save failed:', err);
      setSnackbarMessage(err?.data?.message || 'Failed to save comment');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleDownload = async () => {
    if (!leadId) {
      setSnackbarMessage('No lead ID found');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setSnackbarMessage('Starting download...');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);

    try {
      const token = getToken();

      const response = await axios({
        method: 'GET',
        url: `${process.env.REACT_APP_API_ENDPOINT}/dueDeligenceZip?leids=${leadId}`, 
        responseType: 'blob', 
        headers: {
          Authorization: `Bearer ${token}`,
        },
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadProgress(percent);
          }
        },
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `due-diligence-lead-${leadId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSnackbarMessage('Due Diligence ZIP downloaded successfully');
      setSnackbarSeverity('success');
    } catch (err: any) {
      console.error('Download failed:', err);
      const msg =
        err?.response?.status === 404
          ? 'Due diligence files not found for this lead'
          : err?.message || 'Failed to download due diligence document';
      setSnackbarMessage(msg);
      setSnackbarSeverity('error');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Box sx={{ p: 3, backgroundColor: '#fff', borderRadius: 1 }}>
      {/* Header */}
      {/* <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight={600} color="text.primary">
          Due Diligence
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Add notes, observations, or findings from due diligence process
        </Typography>
      </Box> */}

      <Grid container spacing={3}>
        {/* Comment Field */}
        <Grid item xs={12}>
          <TextField
            label="Due Diligence Comments / Remarks"
            multiline
            rows={6}
            fullWidth
            variant="outlined"
            value={comment}
            onChange={handleCommentChange}
            placeholder=""
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fafafa',
              },
            }}
          />
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              justifyContent: { xs: 'center', sm: 'flex-start' },
            }}
          >
            <Button
              variant="contained"
              color="primary"
              startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={isSaving}
              sx={{ minWidth: 160 }}
            >
              {isSaving ? 'Saving...' : 'Save Comment'}
            </Button>

            <Button
              variant="outlined"
              color="primary"
              startIcon={
                isDownloading ? <CircularProgress size={20} color="primary" /> : <DownloadIcon />
              }
              onClick={handleDownload}
              disabled={isDownloading}
              sx={{ minWidth: 220 }}
            >
              {isDownloading ? 'Downloading...' : 'Download Due Diligence Document'}
            </Button>
          </Box>

          {isDownloading && downloadProgress > 0 && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={downloadProgress} />
              <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                {downloadProgress}% — Generating ZIP...
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        // anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
});

export default DueDiligence;

i want design button CreditAssessmentMemo and one more change DueDiligence that download button at top in  DueDiligence make design more good 
