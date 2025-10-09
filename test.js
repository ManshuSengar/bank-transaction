import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import TitleHeader from "../../Components/titleheader";
import {
  Box,
  Grid,
  Container,
  FormControlLabel,
  Checkbox,
  Typography,
  Paper,
  Snackbar,
  Button,
} from "@mui/material";
import { makeStyles } from "@material-ui/core/styles";
import useToken from "../../Features/Authentication/useToken";
import { skipToken } from "@reduxjs/toolkit/dist/query";
import { useNavigate, useLocation } from "react-router-dom";
import { useGetLeadQuery } from "../../slices/leadSlice";
import AlertError from "../../Components/Framework/AlertError";
import "../../assets/css/common.css";
import VerticalStepper from "../../Components/verticalstepper";
import { useCallback, useEffect, useState } from "react";
import React from "react";
import {
  ColorBackButton,
  SkipColorButton,
  ColorButton,
  ColorCancelButton,
} from "./Buttons";
import SaveColorButton from "../../Components/Framework/ColorButton";
import LegalEntity from "./LegalEntity";
import Lead from "./Lead";
import { SubmitableForm } from "../../Components/Framework/FormSubmit";
import { useAppDispatch } from "../../app/hooks";
import {
  StepStatus,
  setLeadId,
  updateStepStatus,
} from "../../slices/localStores/leadStore";
import LoanDetails from "./LoanDetails";
import KmpContainer from "./KmpContainer";
import SecurityDetailsContainer from "./SecurityDetailsContainer";
import { useParams } from "react-router";
import Bre from "./Bre";
import RepaymentSchedule from "./RepaymentSchedule";
import ReviewAndSubmit from "./ReviewAndSubmit";
import SuccessAnimation from "../../Components/Framework/SuccessAnimation";
import { useUpdateLeadMutation } from "../../slices/leadSlice";
import { useAppSelector } from "../../app/hooks";
import { Link } from "react-router-dom";
import SaveIcon from '@mui/icons-material/Save';
import { ReactComponent as SpinningDotsWhite } from "../../assets/icons/spinning_dots_white.svg";
import { RequestWithParentId, SearchRequest } from "../../models/baseModels";
import { useListRpsOverallQuery, useListRpsSidbiQuery } from "../../slices/rpsListSlice";
import { Rps } from "../../models/rps";

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

const L0Container = () => {
  const [loadingButton, setLoadingButton] = React.useState(false);
  const [loadingButtonSaveNext, setLoadingButtonSaveNext] = React.useState(false);

  const steps = [
    "LEAD_GENERATION",
    "LEGAL_ENTITY",
    "KEY_MANAGEMENT_PERSONNEL",
    "SECURITY_DETAILS",
    "LOAN_DETAILS",
    "BRE",
    "REPAYMENT_SCHEDULE",
    "REVIEW_&_SUBMIT",
  ];

  const LEAD_GENERATION = 0;
  const LEGAL_ENTITY = 1;
  const KEY_MANAGEMENT_PERSONNEL = 2;
  const SECURITY_DETAILS = 3;

  const dispatch = useAppDispatch();
  const { stepStatus } = useAppSelector((state) => state.leadStore);

  const buttons = [
    {
      label: "Save Progress and Close",
      buttonstyle: "secondary_outline",
      action: () => console.log("New button clicked"),
    },
  ];

  const classes = useStyles();
  const location = useLocation();
  const { id: leadId } = useParams();

  // Initialize states, resetting if coming from dashboard
  const [activeStep, setActiveStep] = useState(() => {
    const fromDashboard = location.state?.from === "/" || location.pathname === "/lead";
    if (fromDashboard) {
      localStorage.removeItem(`lead_${leadId}_activeStep`);
      return LEAD_GENERATION;
    }
    const savedStep = localStorage.getItem(`lead_${leadId}_activeStep`);
    return savedStep ? parseInt(savedStep, 10) : LEAD_GENERATION;
  });

  const [stepsStatus, setStepsStatus] = useState(() => {
    const fromDashboard = location.state?.from === "/" || location.pathname === "/lead";
    if (fromDashboard) {
      localStorage.removeItem(`lead_${leadId}_stepsStatus`);
      return ["0", "0", "0", "0", "0", "0", "0", "0"];
    }
    const savedStatus = localStorage.getItem(`lead_${leadId}_stepsStatus`);
    return savedStatus ? JSON.parse(savedStatus) : ["0", "0", "0", "0", "0", "0", "0", "0"];
  });

  const [skipped, setSkipped] = useState(new Set());
  const [isChecked, setIsChecked] = useState(false);
  const formToSubmit = React.useRef<SubmitableForm>(null);
  const [stateAlert, setStateAlert] = useState(false);
  const [stateAlertMessage, setStateAlertMessage] = useState("");
  const [completed] = React.useState<{
    [k: number]: boolean;
  }>({});

  const [updateLeadStatus] = useUpdateLeadMutation();
  const { data: leadDataFetch } = useGetLeadQuery(Number(leadId) || skipToken);
  const navigate = useNavigate();
  const { getRoles } = useToken();
  const setLeadIdRef = useCallback(
    (id: number) => dispatch(setLeadId(id)),
    [dispatch]
  );

  // Save activeStep and stepsStatus to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`lead_${leadId}_activeStep`, activeStep.toString());
    localStorage.setItem(`lead_${leadId}_stepsStatus`, JSON.stringify(stepsStatus));
  }, [activeStep, stepsStatus, leadId]);

  // Handle leadId and navigation
  useEffect(() => {
    if (leadId) setLeadIdRef(Number(leadId));
    if (leadDataFetch !== undefined) {
      if (leadDataFetch?.sidbiStatus !== "CREATION" && getRoles().find((e: string) => e !== "NBFC")) {
        navigate("/restricted");
      }
    }
  }, [leadId, setLeadIdRef, leadDataFetch, navigate, getRoles]);

  const { id: createdLeadId } = useAppSelector((state) => state.leadStore);

  const loanoriginationstep = [
    Lead,
    LegalEntity,
    KmpContainer,
    SecurityDetailsContainer,
    LoanDetails,
    Bre,
    RepaymentSchedule,
    ReviewAndSubmit,
  ];

  const isSaveApplicable = (step: any) => {
    return step === KEY_MANAGEMENT_PERSONNEL || step === SECURITY_DETAILS;
  };

  const isStepSkipped = (step: any) => {
    return skipped.has(step);
  };

  const handleSubmitLast = () => {
    setLoadingButton(true);

    if (skipped.size > 0) {
      setStateAlert(true);
      setStateAlertMessage("Please complete all the steps");
    } else {
      if (Number(createdLeadId))
        updateLeadStatus({
          id: Number(createdLeadId),
          leadStatus: "IN_PROCESS",
          sidbiStatus: "ORIGINATION",
        })
          .unwrap()
          .then((data) => {
            if (data.leadStatus === "IN_PROCESS") {
              let newSkipped = skipped;
              if (isStepSkipped(activeStep)) {
                newSkipped = new Set(newSkipped.values());
                newSkipped.delete(activeStep);
              }

              setActiveStep((prevActiveStep) => prevActiveStep + 1);
              setSkipped(newSkipped);
              scrollToTop();
              // Clear localStorage on successful submission
              localStorage.removeItem(`lead_${leadId}_activeStep`);
              localStorage.removeItem(`lead_${leadId}_stepsStatus`);
            } else {
              alert("Unknown error, please contact support.");
            }
          });
    }
  };

  const scrollToTop = () => {
    const customScrollDiv = document.querySelector(".custom_scroll");
    if (customScrollDiv) {
      customScrollDiv.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const [nextProceed, setNextProceed] = useState(false);
  const [nextRPSDataProceed, setNextRPSDataProceed] = useState(false);
  const rpsInput: RequestWithParentId<SearchRequest<Rps>> = {
    parentId: Number(leadId) || 0,
    requestValue: {},
  };

  const { data: overall } = useListRpsOverallQuery(rpsInput);
  const { data: sidbi } = useListRpsSidbiQuery(rpsInput);
  useEffect(() => {
    if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length === 0) ||
       (Array.isArray(sidbi) && sidbi.length === 0))
    ) {
      setNextProceed(true);
    } else if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length > 0) ||
       (Array.isArray(sidbi) && sidbi.length > 0))
    ) {
      setNextRPSDataProceed(true);

      const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
      const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
      const stepperNext = document.querySelector('.stepper_next');

      if (repaymentScheduleTableParametersDiv) {
        repaymentScheduleTableParametersDiv.classList.remove('d-none');
      }
      if (stepperConfirmRepaymentScheduleTable) {
        stepperConfirmRepaymentScheduleTable.classList.remove('d-none');
      }
    } else {
      setNextProceed(false);
    }
  }, [activeStep, overall, sidbi]);

  const handleNext = async () => {
    setLoadingButtonSaveNext(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let isValidForm = await formToSubmit.current.isValid();
      if (isValidForm) {
        await formToSubmit.current.submit();
        let success = await formToSubmit.current.isValid(true);
        if (success) {
          setActiveStep((prevActiveStep) => prevActiveStep + 1);
          setSkipped(newSkipped);
          dispatch(
            updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
          );
          setStepsStatus((prevStepsStatus) => {
            const newStepsStatus = [...prevStepsStatus];
            newStepsStatus[activeStep] = "1";
            return newStepsStatus;
          });
        }
        scrollToTop();
      } else {
        scrollToTop();
      }
      setLoadingButtonSaveNext(false);
    } else {
      console.error("There is no form in the current page to submit.");
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setSkipped(newSkipped);
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
      scrollToTop();
      setLoadingButtonSaveNext(false);
    }
  };

  const handleNextNonLinear = async (step: any) => {
    setActiveStep(step);

    const breParametersDiv = document.querySelector('.bre_parameters_div');
    const stepperConfirmBre = document.querySelector('.stepper_confirmbre');
    const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
    const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
    const stepperNext = document.querySelector('.stepper_next');

    if (breParametersDiv) {
      breParametersDiv.classList.add('d-none');
    }
    if (stepperConfirmBre) {
      stepperConfirmBre.classList.add('d-none');
    }
    if (repaymentScheduleTableParametersDiv) {
      repaymentScheduleTableParametersDiv.classList.add('d-none');
    }
    if (stepperConfirmRepaymentScheduleTable) {
      stepperConfirmRepaymentScheduleTable.classList.add('d-none');
    }
    if (stepperNext) {
      stepperNext.classList.remove('d-none');
    }
  };

  const handleSave = async () => {
    setLoadingButton(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let success = await formToSubmit.current.submit();
      if (success) {
        scrollToTop();
        setSkipped(newSkipped);
        dispatch(
          updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
        );
        setStepsStatus((prevStepsStatus) => {
          const newStepsStatus = [...prevStepsStatus];
          newStepsStatus[activeStep] = "1";
          return newStepsStatus;
        });
      }
    } else {
      console.error("There is no form in the current page to submit.");
      scrollToTop();
      setSkipped(newSkipped);
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
    }
    setLoadingButton(false);
  };

  const handleBack = () => {
    setLoadingButton(true);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setLoadingButton(false);
  };

  const breadcrumbs = [
    <Link key="1" color="#A9A9A9" to="/">
      Loan Origination
    </Link>,
    <Link key="2" color="#A9A9A9" to="/lead">
      {leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead"}
    </Link>,
  ];

  return (
    <>
      <Snackbar
        open={stateAlert}
        autoHideDuration={3000}
        onClose={() => setStateAlert(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <AlertError
          icon={false}
          severity="error"
          onClose={() => console.log("close")}
        >
          {stateAlertMessage}
        </AlertError>
      </Snackbar>
      {activeStep === steps.length ? (
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
                You have successfully created
                <br />a new lead{" "}
                <span style={{ color: "#1377FF" }}>#{createdLeadId}</span>
              </Typography>
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
                    <Button
                      component={Link}
                      to="/"
                      className="no-underline login_forgot_password"
                      style={{
                        textDecoration: "none",
                        color: "#A9A9A9",
                        fontSize: "14px",
                      }}
                    >
                      {"< Back to Dashboard"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Grid>
        </React.Fragment>
      ) : (
        <div style={{ marginTop: "2.5em", marginBottom: "2.5em" }}>
          <Container maxWidth="xl">
            <div>
              <TitleHeader
                title={leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead"}
                breadcrumbs={breadcrumbs}
                button={buttons}
              />
            </div>

            <div style={{ marginTop: "1.5em" }}>
              <Box sx={{ width: "100%" }}>
                <Grid container spacing={3}>
                  <Grid item xl={3} lg={3.5} md={4} xs={4}>
                    {leadId && leadId !== "NEW" ? (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={true}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    ) : (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={false}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    )}
                  </Grid>

                  <Grid item xl={9} lg={8.5} md={8} xs={8}>
                    <div className="custom_scroll">
                      <React.Fragment>
                        {activeStep >= LEAD_GENERATION &&
                          activeStep < loanoriginationstep.length &&
                          React.createElement(loanoriginationstep[activeStep], {
                            ref: formToSubmit,
                          })}
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            pt: "22px",
                          }}
                        >
                          {activeStep === steps.length - 1 ? (
                            <Grid
                              container
                              spacing={3}
                              padding={0}
                              sx={{ mb: "32px" }}
                            >
                              <Grid item md={8} xs={12}>
                                <FormControlLabel
                                  value="end"
                                  control={
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={(e) =>
                                        setIsChecked(e.target.checked)
                                      }
                                    />
                                  }
                                  label={
                                    <Typography
                                      variant="body2"
                                      gutterBottom
                                      style={{
                                        marginTop: "0px",
                                        marginBottom: "0px",
                                        fontWeight: "400",
                                        color: "#3B415B",
                                      }}
                                    >
                                      I agree to the Terms and Condition{" "}
                                      <b>
                                        On behalf of the NBFC Authorised Person
                                      </b>
                                    </Typography>
                                  }
                                  labelPlacement="end"
                                />
                              </Grid>
                              <Grid
                                item
                                md={4}
                                xs={12}
                                sx={{ textAlign: "right" }}
                              >
                                <ColorButton
                                  variant="contained"
                                  onClick={handleSubmitLast}
                                  startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                  disabled={!isChecked && !loadingButton}
                                  className="stepSubmit"
                                >
                                  Submit
                                </ColorButton>
                              </Grid>
                            </Grid>
                          ) : (
                            <>
                              <ColorBackButton
                                color="inherit"
                                sx={{ mb: "32px" }}
                                onClick={handleBack}
                                startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                disabled={activeStep === 0 && loadingButton}
                                className="colorBackButton"
                              >
                                Back
                              </ColorBackButton>
                              <Box sx={{ flex: "1 1 auto" }} />
                              {isSaveApplicable(activeStep) ? (
                                <>
                                  <SaveColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleSave}
                                    startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButton}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Save
                                  </SaveColorButton>
                                  <ColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleNext}
                                    startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButtonSaveNext}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Next
                                  </ColorButton>
                                </>
                              ) : (
                                <ColorButton
                                  variant="contained"
                                  className="stepper_next"
                                  onClick={handleNext}
                                  sx={{ mb: "32px" }}
                                  startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                  disabled={loadingButtonSaveNext}
                                >
                                  Save & Next
                                </ColorButton>
                              )}
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmbre d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                                startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                disabled={loadingButtonSaveNext}
                              >
                                Confirm BRE
                              </ColorButton>
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmrepaymentschedule d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                              >
                                Confirm Repayment Schedule
                              </ColorButton>
                              <ColorCancelButton
                                variant="contained"
                                className="d-none"
                                sx={{ mb: "32px", ml: 1 }}
                              >
                                Cancel Application
                              </ColorCancelButton>
                            </>
                          )}
                        </Box>
                      </React.Fragment>
                    </div>
                  </Grid>
                </Grid>
              </Box>
            </div>
          </Container>
        </div>
      )}
    </>
  );
};

export default L0Container;

// Redux Slice (unchanged)
export enum StepStatus {
  SUCCESS,
  ERROR,
  SKIP,
}

interface LeadStore {
  id: number | undefined;
  stepStatus: StepStatus[];
}

const initialState: LeadStore = { id: undefined, stepStatus: [] };

export const leadStoreSlice = createSlice({
  name: "leadStore",
  initialState,
  reducers: {
    setLeadId: (state: LeadStore, action: PayloadAction<number>) => {
      state.id = action.payload;
    },
    updateStepStatus: (
      state: LeadStore,
      action: PayloadAction<{ step: number; status: StepStatus }>
    ) => {
      console.log("Updating step status", action.payload);
      if (action.payload.status === StepStatus.SKIP) {
        if (!state.stepStatus[action.payload.step]) {
          state.stepStatus[action.payload.step] = StepStatus.SKIP;
        }
      } else {
        state.stepStatus[action.payload.step] = action.payload.status;
      }
      console.log("Step Status");
      console.log(state.stepStatus?.map((item: any, index: number) => console.log(index, item)));
    },
  },
});

export const { setLeadId, updateStepStatus } = leadStoreSlice.actions;









import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import TitleHeader from "../../Components/titleheader";
import {
  Box,
  Grid,
  Container,
  FormControlLabel,
  Checkbox,
  Typography,
  Paper,
  Snackbar,
  Button,
} from "@mui/material";
import { makeStyles } from "@material-ui/core/styles";
import useToken from "../../Features/Authentication/useToken";
import { skipToken } from "@reduxjs/toolkit/dist/query";
import { useNavigate, useLocation } from "react-router-dom";
import { useGetLeadQuery } from "../../slices/leadSlice";
import AlertError from "../../Components/Framework/AlertError";
import "../../assets/css/common.css";
import VerticalStepper from "../../Components/verticalstepper";
import { useCallback, useEffect, useState } from "react";
import React from "react";
import {
  ColorBackButton,
  SkipColorButton,
  ColorButton,
  ColorCancelButton,
} from "./Buttons";
import SaveColorButton from "../../Components/Framework/ColorButton";
import LegalEntity from "./LegalEntity";
import Lead from "./Lead";
import { SubmitableForm } from "../../Components/Framework/FormSubmit";
import { useAppDispatch } from "../../app/hooks";
import {
  StepStatus,
  setLeadId,
  updateStepStatus,
} from "../../slices/localStores/leadStore";
import LoanDetails from "./LoanDetails";
import KmpContainer from "./KmpContainer";
import SecurityDetailsContainer from "./SecurityDetailsContainer";
import { useParams } from "react-router";
import Bre from "./Bre";
import RepaymentSchedule from "./RepaymentSchedule";
import ReviewAndSubmit from "./ReviewAndSubmit";
import SuccessAnimation from "../../Components/Framework/SuccessAnimation";
import { useUpdateLeadMutation } from "../../slices/leadSlice";
import { useAppSelector } from "../../app/hooks";
import { Link } from "react-router-dom";
import SaveIcon from '@mui/icons-material/Save';
import { ReactComponent as SpinningDotsWhite } from "../../assets/icons/spinning_dots_white.svg";
import { RequestWithParentId, SearchRequest } from "../../models/baseModels";
import { useListRpsOverallQuery, useListRpsSidbiQuery } from "../../slices/rpsListSlice";
import { Rps } from "../../models/rps";

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

const L0Container = () => {
  const [loadingButton, setLoadingButton] = React.useState(false);
  const [loadingButtonSaveNext, setLoadingButtonSaveNext] = React.useState(false);

  const steps = [
    "LEAD_GENERATION",
    "LEGAL_ENTITY",
    "KEY_MANAGEMENT_PERSONNEL",
    "SECURITY_DETAILS",
    "LOAN_DETAILS",
    "BRE",
    "REPAYMENT_SCHEDULE",
    "REVIEW_&_SUBMIT",
  ];

  const LEAD_GENERATION = 0;
  const LEGAL_ENTITY = 1;
  const KEY_MANAGEMENT_PERSONNEL = 2;
  const SECURITY_DETAILS = 3;

  const dispatch = useAppDispatch();
  const { stepStatus } = useAppSelector((state) => state.leadStore);

  const buttons = [
    {
      label: "Save Progress and Close",
      buttonstyle: "secondary_outline",
      action: () => console.log("New button clicked"),
    },
  ];

  const classes = useStyles();
  const location = useLocation();
  const { id: leadId } = useParams();

  // Initialize states, resetting if coming from dashboard
  const [activeStep, setActiveStep] = useState(() => {
    const fromDashboard = location.state?.from === "/" || location.pathname === "/lead";
    if (fromDashboard) {
      localStorage.removeItem(`lead_${leadId}_activeStep`);
      return LEAD_GENERATION;
    }
    const savedStep = localStorage.getItem(`lead_${leadId}_activeStep`);
    return savedStep ? parseInt(savedStep, 10) : LEAD_GENERATION;
  });

  const [stepsStatus, setStepsStatus] = useState(() => {
    const fromDashboard = location.state?.from === "/" || location.pathname === "/lead";
    if (fromDashboard) {
      localStorage.removeItem(`lead_${leadId}_stepsStatus`);
      return ["0", "0", "0", "0", "0", "0", "0", "0"];
    }
    const savedStatus = localStorage.getItem(`lead_${leadId}_stepsStatus`);
    return savedStatus ? JSON.parse(savedStatus) : ["0", "0", "0", "0", "0", "0", "0", "0"];
  });

  const [skipped, setSkipped] = useState(new Set());
  const [isChecked, setIsChecked] = useState(false);
  const formToSubmit = React.useRef<SubmitableForm>(null);
  const [stateAlert, setStateAlert] = useState(false);
  const [stateAlertMessage, setStateAlertMessage] = useState("");
  const [completed] = React.useState<{
    [k: number]: boolean;
  }>({});

  const [updateLeadStatus] = useUpdateLeadMutation();
  const { data: leadDataFetch } = useGetLeadQuery(Number(leadId) || skipToken);
  const navigate = useNavigate();
  const { getRoles } = useToken();
  const setLeadIdRef = useCallback(
    (id: number) => dispatch(setLeadId(id)),
    [dispatch]
  );

  // Save activeStep and stepsStatus to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`lead_${leadId}_activeStep`, activeStep.toString());
    localStorage.setItem(`lead_${leadId}_stepsStatus`, JSON.stringify(stepsStatus));
  }, [activeStep, stepsStatus, leadId]);

  // Handle leadId and navigation
  useEffect(() => {
    if (leadId) setLeadIdRef(Number(leadId));
    if (leadDataFetch !== undefined) {
      if (leadDataFetch?.sidbiStatus !== "CREATION" && getRoles().find((e: string) => e !== "NBFC")) {
        navigate("/restricted");
      }
    }
  }, [leadId, setLeadIdRef, leadDataFetch, navigate, getRoles]);

  const { id: createdLeadId } = useAppSelector((state) => state.leadStore);

  const loanoriginationstep = [
    Lead,
    LegalEntity,
    KmpContainer,
    SecurityDetailsContainer,
    LoanDetails,
    Bre,
    RepaymentSchedule,
    ReviewAndSubmit,
  ];

  const isSaveApplicable = (step: any) => {
    return step === KEY_MANAGEMENT_PERSONNEL || step === SECURITY_DETAILS;
  };

  const isStepSkipped = (step: any) => {
    return skipped.has(step);
  };

  const handleSubmitLast = () => {
    setLoadingButton(true);

    if (skipped.size > 0) {
      setStateAlert(true);
      setStateAlertMessage("Please complete all the steps");
    } else {
      if (Number(createdLeadId))
        updateLeadStatus({
          id: Number(createdLeadId),
          leadStatus: "IN_PROCESS",
          sidbiStatus: "ORIGINATION",
        })
          .unwrap()
          .then((data) => {
            if (data.leadStatus === "IN_PROCESS") {
              let newSkipped = skipped;
              if (isStepSkipped(activeStep)) {
                newSkipped = new Set(newSkipped.values());
                newSkipped.delete(activeStep);
              }

              setActiveStep((prevActiveStep) => prevActiveStep + 1);
              setSkipped(newSkipped);
              scrollToTop();
              // Clear localStorage on successful submission
              localStorage.removeItem(`lead_${leadId}_activeStep`);
              localStorage.removeItem(`lead_${leadId}_stepsStatus`);
            } else {
              alert("Unknown error, please contact support.");
            }
          });
    }
  };

  const scrollToTop = () => {
    const customScrollDiv = document.querySelector(".custom_scroll");
    if (customScrollDiv) {
      customScrollDiv.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const [nextProceed, setNextProceed] = useState(false);
  const [nextRPSDataProceed, setNextRPSDataProceed] = useState(false);
  const rpsInput: RequestWithParentId<SearchRequest<Rps>> = {
    parentId: Number(leadId) || 0,
    requestValue: {},
  };

  const { data: overall } = useListRpsOverallQuery(rpsInput);
  const { data: sidbi } = useListRpsSidbiQuery(rpsInput);
  useEffect(() => {
    if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length === 0) ||
       (Array.isArray(sidbi) && sidbi.length === 0))
    ) {
      setNextProceed(true);
    } else if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length > 0) ||
       (Array.isArray(sidbi) && sidbi.length > 0))
    ) {
      setNextRPSDataProceed(true);

      const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
      const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
      const stepperNext = document.querySelector('.stepper_next');

      if (repaymentScheduleTableParametersDiv) {
        repaymentScheduleTableParametersDiv.classList.remove('d-none');
      }
      if (stepperConfirmRepaymentScheduleTable) {
        stepperConfirmRepaymentScheduleTable.classList.remove('d-none');
      }
    } else {
      setNextProceed(false);
    }
  }, [activeStep, overall, sidbi]);

  const handleNext = async () => {
    setLoadingButtonSaveNext(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let isValidForm = await formToSubmit.current.isValid();
      if (isValidForm) {
        await formToSubmit.current.submit();
        let success = await formToSubmit.current.isValid(true);
        if (success) {
          setActiveStep((prevActiveStep) => prevActiveStep + 1);
          setSkipped(newSkipped);
          dispatch(
            updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
          );
          setStepsStatus((prevStepsStatus) => {
            const newStepsStatus = [...prevStepsStatus];
            newStepsStatus[activeStep] = "1";
            return newStepsStatus;
          });
        }
        scrollToTop();
      } else {
        scrollToTop();
      }
      setLoadingButtonSaveNext(false);
    } else {
      console.error("There is no form in the current page to submit.");
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setSkipped(newSkipped);
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
      scrollToTop();
      setLoadingButtonSaveNext(false);
    }
  };

  const handleNextNonLinear = async (step: any) => {
    setActiveStep(step);

    const breParametersDiv = document.querySelector('.bre_parameters_div');
    const stepperConfirmBre = document.querySelector('.stepper_confirmbre');
    const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
    const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
    const stepperNext = document.querySelector('.stepper_next');

    if (breParametersDiv) {
      breParametersDiv.classList.add('d-none');
    }
    if (stepperConfirmBre) {
      stepperConfirmBre.classList.add('d-none');
    }
    if (repaymentScheduleTableParametersDiv) {
      repaymentScheduleTableParametersDiv.classList.add('d-none');
    }
    if (stepperConfirmRepaymentScheduleTable) {
      stepperConfirmRepaymentScheduleTable.classList.add('d-none');
    }
    if (stepperNext) {
      stepperNext.classList.remove('d-none');
    }
  };

  const handleSave = async () => {
    setLoadingButton(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let success = await formToSubmit.current.submit();
      if (success) {
        scrollToTop();
        setSkipped(newSkipped);
        dispatch(
          updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
        );
        setStepsStatus((prevStepsStatus) => {
          const newStepsStatus = [...prevStepsStatus];
          newStepsStatus[activeStep] = "1";
          return newStepsStatus;
        });
      }
    } else {
      console.error("There is no form in the current page to submit.");
      scrollToTop();
      setSkipped(newSkipped);
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
    }
    setLoadingButton(false);
  };

  const handleBack = () => {
    setLoadingButton(true);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setLoadingButton(false);
  };

  const breadcrumbs = [
    <Link key="1" color="#A9A9A9" to="/">
      Loan Origination
    </Link>,
    <Link key="2" color="#A9A9A9" to="/lead">
      {leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead"}
    </Link>,
  ];

  return (
    <>
      <Snackbar
        open={stateAlert}
        autoHideDuration={3000}
        onClose={() => setStateAlert(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <AlertError
          icon={false}
          severity="error"
          onClose={() => console.log("close")}
        >
          {stateAlertMessage}
        </AlertError>
      </Snackbar>
      {activeStep === steps.length ? (
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
                You have successfully created
                <br />a new lead{" "}
                <span style={{ color: "#1377FF" }}>#{createdLeadId}</span>
              </Typography>
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
                    <Button
                      component={Link}
                      to="/"
                      className="no-underline login_forgot_password"
                      style={{
                        textDecoration: "none",
                        color: "#A9A9A9",
                        fontSize: "14px",
                      }}
                    >
                      {"< Back to Dashboard"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Grid>
        </React.Fragment>
      ) : (
        <div style={{ marginTop: "2.5em", marginBottom: "2.5em" }}>
          <Container maxWidth="xl">
            <div>
              <TitleHeader
                title={leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead"}
                breadcrumbs={breadcrumbs}
                button={buttons}
              />
            </div>

            <div style={{ marginTop: "1.5em" }}>
              <Box sx={{ width: "100%" }}>
                <Grid container spacing={3}>
                  <Grid item xl={3} lg={3.5} md={4} xs={4}>
                    {leadId && leadId !== "NEW" ? (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={true}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    ) : (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={false}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    )}
                  </Grid>

                  <Grid item xl={9} lg={8.5} md={8} xs={8}>
                    <div className="custom_scroll">
                      <React.Fragment>
                        {activeStep >= LEAD_GENERATION &&
                          activeStep < loanoriginationstep.length &&
                          React.createElement(loanoriginationstep[activeStep], {
                            ref: formToSubmit,
                          })}
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            pt: "22px",
                          }}
                        >
                          {activeStep === steps.length - 1 ? (
                            <Grid
                              container
                              spacing={3}
                              padding={0}
                              sx={{ mb: "32px" }}
                            >
                              <Grid item md={8} xs={12}>
                                <FormControlLabel
                                  value="end"
                                  control={
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={(e) =>
                                        setIsChecked(e.target.checked)
                                      }
                                    />
                                  }
                                  label={
                                    <Typography
                                      variant="body2"
                                      gutterBottom
                                      style={{
                                        marginTop: "0px",
                                        marginBottom: "0px",
                                        fontWeight: "400",
                                        color: "#3B415B",
                                      }}
                                    >
                                      I agree to the Terms and Condition{" "}
                                      <b>
                                        On behalf of the NBFC Authorised Person
                                      </b>
                                    </Typography>
                                  }
                                  labelPlacement="end"
                                />
                              </Grid>
                              <Grid
                                item
                                md={4}
                                xs={12}
                                sx={{ textAlign: "right" }}
                              >
                                <ColorButton
                                  variant="contained"
                                  onClick={handleSubmitLast}
                                  startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                  disabled={!isChecked && !loadingButton}
                                  className="stepSubmit"
                                >
                                  Submit
                                </ColorButton>
                              </Grid>
                            </Grid>
                          ) : (
                            <>
                              <ColorBackButton
                                color="inherit"
                                sx={{ mb: "32px" }}
                                onClick={handleBack}
                                startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                disabled={activeStep === 0 && loadingButton}
                                className="colorBackButton"
                              >
                                Back
                              </ColorBackButton>
                              <Box sx={{ flex: "1 1 auto" }} />
                              {isSaveApplicable(activeStep) ? (
                                <>
                                  <SaveColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleSave}
                                    startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButton}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Save
                                  </SaveColorButton>
                                  <ColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleNext}
                                    startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButtonSaveNext}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Next
                                  </ColorButton>
                                </>
                              ) : (
                                <ColorButton
                                  variant="contained"
                                  className="stepper_next"
                                  onClick={handleNext}
                                  sx={{ mb: "32px" }}
                                  startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                  disabled={loadingButtonSaveNext}
                                >
                                  Save & Next
                                </ColorButton>
                              )}
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmbre d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                                startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                disabled={loadingButtonSaveNext}
                              >
                                Confirm BRE
                              </ColorButton>
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmrepaymentschedule d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                              >
                                Confirm Repayment Schedule
                              </ColorButton>
                              <ColorCancelButton
                                variant="contained"
                                className="d-none"
                                sx={{ mb: "32px", ml: 1 }}
                              >
                                Cancel Application
                              </ColorCancelButton>
                            </>
                          )}
                        </Box>
                      </React.Fragment>
                    </div>
                  </Grid>
                </Grid>
              </Box>
            </div>
          </Container>
        </div>
      )}
    </>
  );
};

export default L0Container;

// Redux Slice (unchanged)
export enum StepStatus {
  SUCCESS,
  ERROR,
  SKIP,
}

interface LeadStore {
  id: number | undefined;
  stepStatus: StepStatus[];
}

const initialState: LeadStore = { id: undefined, stepStatus: [] };

export const leadStoreSlice = createSlice({
  name: "leadStore",
  initialState,
  reducers: {
    setLeadId: (state: LeadStore, action: PayloadAction<number>) => {
      state.id = action.payload;
    },
    updateStepStatus: (
      state: LeadStore,
      action: PayloadAction<{ step: number; status: StepStatus }>
    ) => {
      console.log("Updating step status", action.payload);
      if (action.payload.status === StepStatus.SKIP) {
        if (!state.stepStatus[action.payload.step]) {
          state.stepStatus[action.payload.step] = StepStatus.SKIP;
        }
      } else {
        state.stepStatus[action.payload.step] = action.payload.status;
      }
      console.log("Step Status");
      console.log(state.stepStatus?.map((item: any, index: number) => console.log(index, item)));
    },
  },
});

export const { setLeadId, updateStepStatus } = leadStoreSlice.actions;





















import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import TitleHeader from "../../Components/titleheader";
import {
  Box,
  Grid,
  Container,
  FormControlLabel,
  Checkbox,
  Typography,
  Paper,
  Snackbar,
  Button,
} from "@mui/material";
import { makeStyles } from "@material-ui/core/styles";
import useToken from "../../Features/Authentication/useToken";
import { skipToken } from "@reduxjs/toolkit/dist/query";
import { useNavigate } from "react-router-dom";
import { useGetLeadQuery } from "../../slices/leadSlice";
import AlertError from "../../Components/Framework/AlertError";
import "../../assets/css/common.css";
import VerticalStepper from "../../Components/verticalstepper";
import { useCallback, useEffect, useState } from "react";
import React from "react";
import {
  ColorBackButton,
  SkipColorButton,
  ColorButton,
  ColorCancelButton,
} from "./Buttons";
import SaveColorButton from "../../Components/Framework/ColorButton";
import LegalEntity from "./LegalEntity";
import Lead from "./Lead";
import { SubmitableForm } from "../../Components/Framework/FormSubmit";
import { useAppDispatch } from "../../app/hooks";
import {
  StepStatus,
  setLeadId,
  updateStepStatus,
} from "../../slices/localStores/leadStore";
import LoanDetails from "./LoanDetails";
import KmpContainer from "./KmpContainer";
import SecurityDetailsContainer from "./SecurityDetailsContainer";
import { useParams } from "react-router";
import Bre from "./Bre";
import RepaymentSchedule from "./RepaymentSchedule";
import ReviewAndSubmit from "./ReviewAndSubmit";
import SuccessAnimation from "../../Components/Framework/SuccessAnimation";
import { useUpdateLeadMutation } from "../../slices/leadSlice";
import { useAppSelector } from "../../app/hooks";
import { Link } from "react-router-dom";
import SaveIcon from '@mui/icons-material/Save';
import { ReactComponent as SpinningDotsWhite } from "../../assets/icons/spinning_dots_white.svg";
import { RequestWithParentId, SearchRequest } from "../../models/baseModels";
import { useListRpsOverallQuery, useListRpsSidbiQuery } from "../../slices/rpsListSlice";
import { Rps } from "../../models/rps";

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

const L0Container = () => {
  const [loadingButton, setLoadingButton] = React.useState(false);
  const [loadingButtonSaveNext, setLoadingButtonSaveNext] = React.useState(false);

  const steps = [
    "LEAD_GENERATION",
    "LEGAL_ENTITY",
    "KEY_MANAGEMENT_PERSONNEL",
    "SECURITY_DETAILS",
    "LOAN_DETAILS",
    "BRE",
    "REPAYMENT_SCHEDULE",
    "REVIEW_&_SUBMIT",
  ];

  const LEAD_GENERATION = 0;
  const LEGAL_ENTITY = 1;
  const KEY_MANAGEMENT_PERSONNEL = 2;
  const SECURITY_DETAILS = 3;

  const dispatch = useAppDispatch();
  const { stepStatus } = useAppSelector((state) => state.leadStore);

  const buttons = [
    {
      label: "Save Progress and Close",
      buttonstyle: "secondary_outline",
      action: () => console.log("New button clicked"),
    },
  ];

  const classes = useStyles();

  // Initialize states to default values (reset on every mount)
  const [activeStep, setActiveStep] = useState(LEAD_GENERATION);
  const [stepsStatus, setStepsStatus] = useState(["0", "0", "0", "0", "0", "0", "0", "0"]);
  const [skipped, setSkipped] = useState(new Set());
  const [isChecked, setIsChecked] = useState(false);
  const formToSubmit = React.useRef<SubmitableForm>(null);
  const [stateAlert, setStateAlert] = useState(false);
  const [stateAlertMessage, setStateAlertMessage] = useState("");
  const [completed] = React.useState<{
    [k: number]: boolean;
  }>({});

  const [updateLeadStatus] = useUpdateLeadMutation();
  const { id: leadId } = useParams();
  const { data: leadDataFetch } = useGetLeadQuery(Number(leadId) || skipToken);
  const navigate = useNavigate();
  const { getRoles } = useToken();
  const setLeadIdRef = useCallback(
    (id: number) => dispatch(setLeadId(id)),
    [dispatch]
  );

  // Handle leadId and navigation
  useEffect(() => {
    if (leadId) setLeadIdRef(Number(leadId));
    if (leadDataFetch !== undefined) {
      if (leadDataFetch?.sidbiStatus !== "CREATION" && getRoles().find((e: string) => e !== "NBFC")) {
        navigate("/restricted");
      }
    }
  }, [leadId, setLeadIdRef, leadDataFetch, navigate, getRoles]);

  const { id: createdLeadId } = useAppSelector((state) => state.leadStore);

  const loanoriginationstep = [
    Lead,
    LegalEntity,
    KmpContainer,
    SecurityDetailsContainer,
    LoanDetails,
    Bre,
    RepaymentSchedule,
    ReviewAndSubmit,
  ];

  const isSaveApplicable = (step: any) => {
    return step === KEY_MANAGEMENT_PERSONNEL || step === SECURITY_DETAILS;
  };

  const isStepSkipped = (step: any) => {
    return skipped.has(step);
  };

  const handleSubmitLast = () => {
    setLoadingButton(true);

    if (skipped.size > 0) {
      setStateAlert(true);
      setStateAlertMessage("Please complete all the steps");
    } else {
      if (Number(createdLeadId))
        updateLeadStatus({
          id: Number(createdLeadId),
          leadStatus: "IN_PROCESS",
          sidbiStatus: "ORIGINATION",
        })
          .unwrap()
          .then((data) => {
            if (data.leadStatus === "IN_PROCESS") {
              let newSkipped = skipped;
              if (isStepSkipped(activeStep)) {
                newSkipped = new Set(newSkipped.values());
                newSkipped.delete(activeStep);
              }

              setActiveStep((prevActiveStep) => prevActiveStep + 1);
              setSkipped(newSkipped);
              scrollToTop();
            } else {
              alert("Unknown error, please contact support.");
            }
          });
    }
  };

  const scrollToTop = () => {
    const customScrollDiv = document.querySelector(".custom_scroll");
    if (customScrollDiv) {
      customScrollDiv.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const [nextProceed, setNextProceed] = useState(false);
  const [nextRPSDataProceed, setNextRPSDataProceed] = useState(false);
  const rpsInput: RequestWithParentId<SearchRequest<Rps>> = {
    parentId: Number(leadId) || 0,
    requestValue: {},
  };

  const { data: overall } = useListRpsOverallQuery(rpsInput);
  const { data: sidbi } = useListRpsSidbiQuery(rpsInput);
  useEffect(() => {
    if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length === 0) ||
       (Array.isArray(sidbi) && sidbi.length === 0))
    ) {
      setNextProceed(true);
    } else if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length > 0) ||
       (Array.isArray(sidbi) && sidbi.length > 0))
    ) {
      setNextRPSDataProceed(true);

      const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
      const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
      const stepperNext = document.querySelector('.stepper_next');

      if (repaymentScheduleTableParametersDiv) {
        repaymentScheduleTableParametersDiv.classList.remove('d-none');
      }
      if (stepperConfirmRepaymentScheduleTable) {
        stepperConfirmRepaymentScheduleTable.classList.remove('d-none');
      }
    } else {
      setNextProceed(false);
    }
  }, [activeStep, overall, sidbi]);

  const handleNext = async () => {
    setLoadingButtonSaveNext(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let isValidForm = await formToSubmit.current.isValid();
      if (isValidForm) {
        await formToSubmit.current.submit();
        let success = await formToSubmit.current.isValid(true);
        if (success) {
          setActiveStep((prevActiveStep) => prevActiveStep + 1);
          setSkipped(newSkipped);
          dispatch(
            updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
          );
          setStepsStatus((prevStepsStatus) => {
            const newStepsStatus = [...prevStepsStatus];
            newStepsStatus[activeStep] = "1";
            return newStepsStatus;
          });
        }
        scrollToTop();
      } else {
        scrollToTop();
      }
      setLoadingButtonSaveNext(false);
    } else {
      console.error("There is no form in the current page to submit.");
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setSkipped(newSkipped);
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
      scrollToTop();
      setLoadingButtonSaveNext(false);
    }
  };

  const handleNextNonLinear = async (step: any) => {
    setActiveStep(step);

    const breParametersDiv = document.querySelector('.bre_parameters_div');
    const stepperConfirmBre = document.querySelector('.stepper_confirmbre');
    const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
    const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
    const stepperNext = document.querySelector('.stepper_next');

    if (breParametersDiv) {
      breParametersDiv.classList.add('d-none');
    }
    if (stepperConfirmBre) {
      stepperConfirmBre.classList.add('d-none');
    }
    if (repaymentScheduleTableParametersDiv) {
      repaymentScheduleTableParametersDiv.classList.add('d-none');
    }
    if (stepperConfirmRepaymentScheduleTable) {
      stepperConfirmRepaymentScheduleTable.classList.add('d-none');
    }
    if (stepperNext) {
      stepperNext.classList.remove('d-none');
    }
  };

  const handleSave = async () => {
    setLoadingButton(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let success = await formToSubmit.current.submit();
      if (success) {
        scrollToTop();
        setSkipped(newSkipped);
        dispatch(
          updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
        );
        setStepsStatus((prevStepsStatus) => {
          const newStepsStatus = [...prevStepsStatus];
          newStepsStatus[activeStep] = "1";
          return newStepsStatus;
        });
      }
    } else {
      console.error("There is no form in the current page to submit.");
      scrollToTop();
      setSkipped(newSkipped);
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
    }
    setLoadingButton(false);
  };

  const handleBack = () => {
    setLoadingButton(true);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setLoadingButton(false);
  };

  const breadcrumbs = [
    <Link key="1" color="#A9A9A9" to="/">
      Loan Origination
    </Link>,
    <Link key="2" color="#A9A9A9" to="/lead">
      {leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead"}
    </Link>,
  ];

  return (
    <>
      <Snackbar
        open={stateAlert}
        autoHideDuration={3000}
        onClose={() => setStateAlert(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <AlertError
          icon={false}
          severity="error"
          onClose={() => console.log("close")}
        >
          {stateAlertMessage}
        </AlertError>
      </Snackbar>
      {activeStep === steps.length ? (
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
                You have successfully created
                <br />a new lead{" "}
                <span style={{ color: "#1377FF" }}>#{createdLeadId}</span>
              </Typography>
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
                    <Button
                      component={Link}
                      to="/"
                      className="no-underline login_forgot_password"
                      style={{
                        textDecoration: "none",
                        color: "#A9A9A9",
                        fontSize: "14px",
                      }}
                    >
                      {"< Back to Dashboard"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Grid>
        </React.Fragment>
      ) : (
        <div style={{ marginTop: "2.5em", marginBottom: "2.5em" }}>
          <Container maxWidth="xl">
            <div>
              <TitleHeader
                title={leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead"}
                breadcrumbs={breadcrumbs}
                button={buttons}
              />
            </div>

            <div style={{ marginTop: "1.5em" }}>
              <Box sx={{ width: "100%" }}>
                <Grid container spacing={3}>
                  <Grid item xl={3} lg={3.5} md={4} xs={4}>
                    {leadId && leadId !== "NEW" ? (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={true}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    ) : (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={false}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    )}
                  </Grid>

                  <Grid item xl={9} lg={8.5} md={8} xs={8}>
                    <div className="custom_scroll">
                      <React.Fragment>
                        {activeStep >= LEAD_GENERATION &&
                          activeStep < loanoriginationstep.length &&
                          React.createElement(loanoriginationstep[activeStep], {
                            ref: formToSubmit,
                          })}
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            pt: "22px",
                          }}
                        >
                          {activeStep === steps.length - 1 ? (
                            <Grid
                              container
                              spacing={3}
                              padding={0}
                              sx={{ mb: "32px" }}
                            >
                              <Grid item md={8} xs={12}>
                                <FormControlLabel
                                  value="end"
                                  control={
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={(e) =>
                                        setIsChecked(e.target.checked)
                                      }
                                    />
                                  }
                                  label={
                                    <Typography
                                      variant="body2"
                                      gutterBottom
                                      style={{
                                        marginTop: "0px",
                                        marginBottom: "0px",
                                        fontWeight: "400",
                                        color: "#3B415B",
                                      }}
                                    >
                                      I agree to the Terms and Condition{" "}
                                      <b>
                                        On behalf of the NBFC Authorised Person
                                      </b>
                                    </Typography>
                                  }
                                  labelPlacement="end"
                                />
                              </Grid>
                              <Grid
                                item
                                md={4}
                                xs={12}
                                sx={{ textAlign: "right" }}
                              >
                                <ColorButton
                                  variant="contained"
                                  onClick={handleSubmitLast}
                                  startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                  disabled={!isChecked && !loadingButton}
                                  className="stepSubmit"
                                >
                                  Submit
                                </ColorButton>
                              </Grid>
                            </Grid>
                          ) : (
                            <>
                              <ColorBackButton
                                color="inherit"
                                sx={{ mb: "32px" }}
                                onClick={handleBack}
                                startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                disabled={activeStep === 0 && loadingButton}
                                className="colorBackButton"
                              >
                                Back
                              </ColorBackButton>
                              <Box sx={{ flex: "1 1 auto" }} />
                              {isSaveApplicable(activeStep) ? (
                                <>
                                  <SaveColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleSave}
                                    startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButton}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Save
                                  </SaveColorButton>
                                  <ColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleNext}
                                    startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButtonSaveNext}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Next
                                  </ColorButton>
                                </>
                              ) : (
                                <ColorButton
                                  variant="contained"
                                  className="stepper_next"
                                  onClick={handleNext}
                                  sx={{ mb: "32px" }}
                                  startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                  disabled={loadingButtonSaveNext}
                                >
                                  Save & Next
                                </ColorButton>
                              )}
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmbre d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                                startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                disabled={loadingButtonSaveNext}
                              >
                                Confirm BRE
                              </ColorButton>
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmrepaymentschedule d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                              >
                                Confirm Repayment Schedule
                              </ColorButton>
                              <ColorCancelButton
                                variant="contained"
                                className="d-none"
                                sx={{ mb: "32px", ml: 1 }}
                              >
                                Cancel Application
                              </ColorCancelButton>
                            </>
                          )}
                        </Box>
                      </React.Fragment>
                    </div>
                  </Grid>
                </Grid>
              </Box>
            </div>
          </Container>
        </div>
      )}
    </>
  );
};

export default L0Container;

// Redux Slice (unchanged)
export enum StepStatus {
  SUCCESS,
  ERROR,
  SKIP,
}

interface LeadStore {
  id: number | undefined;
  stepStatus: StepStatus[];
}

const initialState: LeadStore = { id: undefined, stepStatus: [] };

export const leadStoreSlice = createSlice({
  name: "leadStore",
  initialState,
  reducers: {
    setLeadId: (state: LeadStore, action: PayloadAction<number>) => {
      state.id = action.payload;
    },
    updateStepStatus: (
      state: LeadStore,
      action: PayloadAction<{ step: number; status: StepStatus }>
    ) => {
      console.log("Updating step status", action.payload);
      if (action.payload.status === StepStatus.SKIP) {
        if (!state.stepStatus[action.payload.step]) {
          state.stepStatus[action.payload.step] = StepStatus.SKIP;
        }
      } else {
        state.stepStatus[action.payload.step] = action.payload.status;
      }
      console.log("Step Status");
      console.log(state.stepStatus?.map((item: any, index: number) => console.log(index, item)));
    },
  },
});

export const { setLeadId, updateStepStatus } = leadStoreSlice.actions;













import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import TitleHeader from "../../Components/titleheader";
import {
  Box,
  Grid,
  Container,
  FormControlLabel,
  Checkbox,
  Typography,
  Paper,
  Snackbar,
  Button,
} from "@mui/material";
import { makeStyles } from "@material-ui/core/styles";
import useToken from "../../Features/Authentication/useToken";
import { skipToken } from "@reduxjs/toolkit/dist/query";
import { useNavigate } from "react-router-dom";
import { useGetLeadQuery } from "../../slices/leadSlice";
import AlertError from "../../Components/Framework/AlertError";
import "../../assets/css/common.css";
import VerticalStepper from "../../Components/verticalstepper";
import { useCallback, useEffect, useState } from "react";
import React from "react";
import {
  ColorBackButton,
  SkipColorButton,
  ColorButton,
  ColorCancelButton,
} from "./Buttons";
import SaveColorButton from "../../Components/Framework/ColorButton";
import LegalEntity from "./LegalEntity";
import Lead from "./Lead";
import { SubmitableForm } from "../../Components/Framework/FormSubmit";
import { useAppDispatch } from "../../app/hooks";
import {
  StepStatus,
  setLeadId,
  updateStepStatus,
} from "../../slices/localStores/leadStore";
import LoanDetails from "./LoanDetails";
import KmpContainer from "./KmpContainer";
import SecurityDetailsContainer from "./SecurityDetailsContainer";
import { useParams } from "react-router";
import Bre from "./Bre";
import RepaymentSchedule from "./RepaymentSchedule";
import ReviewAndSubmit from "./ReviewAndSubmit";
import SuccessAnimation from "../../Components/Framework/SuccessAnimation";
import { useUpdateLeadMutation } from "../../slices/leadSlice";
import { useAppSelector } from "../../app/hooks";
import { Link } from "react-router-dom";
import SaveIcon from '@mui/icons-material/Save';
import { ReactComponent as SpinningDotsWhite } from "../../assets/icons/spinning_dots_white.svg";
import { RequestWithParentId, SearchRequest } from "../../models/baseModels";
import { useListRpsOverallQuery, useListRpsSidbiQuery } from "../../slices/rpsListSlice";
import { Rps } from "../../models/rps";

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

const L0Container = () => {
  const [loadingButton, setLoadingButton] = React.useState(false);
  const [loadingButtonSaveNext, setLoadingButtonSaveNext] = React.useState(false);

  const steps = [
    "LEAD_GENERATION",
    "LEGAL_ENTITY",
    "KEY_MANAGEMENT_PERSONNEL",
    "SECURITY_DETAILS",
    "LOAN_DETAILS",
    "BRE",
    "REPAYMENT_SCHEDULE",
    "REVIEW_&_SUBMIT",
  ];

  const LEAD_GENERATION = 0;
  const LEGAL_ENTITY = 1;
  const KEY_MANAGEMENT_PERSONNEL = 2;
  const SECURITY_DETAILS = 3;

  const dispatch = useAppDispatch();
  const { stepStatus } = useAppSelector((state) => state.leadStore);

  const buttons = [
    {
      label: "Save Progress and Close",
      buttonstyle: "secondary_outline",
      action: () => console.log("New button clicked"),
    },
  ];

  const classes = useStyles();

  // Initialize activeStep and stepsStatus from localStorage or default values
  const [activeStep, setActiveStep] = useState(() => {
    const savedStep = localStorage.getItem(`lead_${leadId}_activeStep`);
    return savedStep ? parseInt(savedStep, 10) : LEAD_GENERATION;
  });
  const [stepsStatus, setStepsStatus] = useState(() => {
    const savedStatus = localStorage.getItem(`lead_${leadId}_stepsStatus`);
    return savedStatus ? JSON.parse(savedStatus) : ["0", "0", "0", "0", "0", "0", "0", "0"];
  });
  const [skipped, setSkipped] = useState(new Set());
  const [isChecked, setIsChecked] = useState(false);
  const formToSubmit = React.useRef<SubmitableForm>(null);
  const [stateAlert, setStateAlert] = useState(false);
  const [stateAlertMessage, setStateAlertMessage] = useState("");
  const [completed] = React.useState<{
    [k: number]: boolean;
  }>({});

  const [updateLeadStatus] = useUpdateLeadMutation();
  const { id: leadId } = useParams();
  const { data: leadDataFetch } = useGetLeadQuery(Number(leadId) || skipToken);
  const navigate = useNavigate();
  const { getRoles } = useToken();
  const setLeadIdRef = useCallback(
    (id: number) => dispatch(setLeadId(id)),
    [dispatch]
  );

  // Save activeStep and stepsStatus to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`lead_${leadId}_activeStep`, activeStep.toString());
    localStorage.setItem(`lead_${leadId}_stepsStatus`, JSON.stringify(stepsStatus));
  }, [activeStep, stepsStatus, leadId]);

  // Handle leadId and navigation
  useEffect(() => {
    if (leadId) setLeadIdRef(Number(leadId));
    if (leadDataFetch !== undefined) {
      if (leadDataFetch?.sidbiStatus !== "CREATION" && getRoles().find((e: string) => e !== "NBFC")) {
        navigate("/restricted");
      }
    }
  }, [leadId, setLeadIdRef, leadDataFetch, navigate, getRoles]);

  const { id: createdLeadId } = useAppSelector((state) => state.leadStore);

  const loanoriginationstep = [
    Lead,
    LegalEntity,
    KmpContainer,
    SecurityDetailsContainer,
    LoanDetails,
    Bre,
    RepaymentSchedule,
    ReviewAndSubmit,
  ];

  const isSaveApplicable = (step: any) => {
    return step === KEY_MANAGEMENT_PERSONNEL || step === SECURITY_DETAILS;
  };

  const isStepSkipped = (step: any) => {
    return skipped.has(step);
  };

  const handleSubmitLast = () => {
    setLoadingButton(true);

    if (skipped.size > 0) {
      setStateAlert(true);
      setStateAlertMessage("Please complete all the steps");
    } else {
      if (Number(createdLeadId))
        updateLeadStatus({
          id: Number(createdLeadId),
          leadStatus: "IN_PROCESS",
          sidbiStatus: "ORIGINATION",
        })
          .unwrap()
          .then((data) => {
            if (data.leadStatus === "IN_PROCESS") {
              let newSkipped = skipped;
              if (isStepSkipped(activeStep)) {
                newSkipped = new Set(newSkipped.values());
                newSkipped.delete(activeStep);
              }

              setActiveStep((prevActiveStep) => prevActiveStep + 1);
              setSkipped(newSkipped);
              scrollToTop();
              // Clear localStorage on successful submission
              localStorage.removeItem(`lead_${leadId}_activeStep`);
              localStorage.removeItem(`lead_${leadId}_stepsStatus`);
            } else {
              alert("Unknown error, please contact support.");
            }
          });
    }
  };

  const scrollToTop = () => {
    const customScrollDiv = document.querySelector(".custom_scroll");
    if (customScrollDiv) {
      customScrollDiv.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const [nextProceed, setNextProceed] = useState(false);
  const [nextRPSDataProceed, setNextRPSDataProceed] = useState(false);
  const rpsInput: RequestWithParentId<SearchRequest<Rps>> = {
    parentId: Number(leadId) || 0,
    requestValue: {},
  };

  const { data: overall } = useListRpsOverallQuery(rpsInput);
  const { data: sidbi } = useListRpsSidbiQuery(rpsInput);
  useEffect(() => {
    if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length === 0) ||
       (Array.isArray(sidbi) && sidbi.length === 0))
    ) {
      setNextProceed(true);
    } else if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length > 0) ||
       (Array.isArray(sidbi) && sidbi.length > 0))
    ) {
      setNextRPSDataProceed(true);

      const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
      const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
      const stepperNext = document.querySelector('.stepper_next');

      if (repaymentScheduleTableParametersDiv) {
        repaymentScheduleTableParametersDiv.classList.remove('d-none');
      }
      if (stepperConfirmRepaymentScheduleTable) {
        stepperConfirmRepaymentScheduleTable.classList.remove('d-none');
      }
    } else {
      setNextProceed(false);
    }
  }, [activeStep, overall, sidbi]);

  const handleNext = async () => {
    setLoadingButtonSaveNext(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let isValidForm = await formToSubmit.current.isValid();
      if (isValidForm) {
        await formToSubmit.current.submit();
        let success = await formToSubmit.current.isValid(true);
        if (success) {
          setActiveStep((prevActiveStep) => prevActiveStep + 1);
          setSkipped(newSkipped);
          dispatch(
            updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
          );
          setStepsStatus((prevStepsStatus) => {
            const newStepsStatus = [...prevStepsStatus];
            newStepsStatus[activeStep] = "1";
            return newStepsStatus;
          });
        }
        scrollToTop();
      } else {
        scrollToTop();
      }
      setLoadingButtonSaveNext(false);
    } else {
      console.error("There is no form in the current page to submit.");
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setSkipped(newSkipped);
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
      scrollToTop();
      setLoadingButtonSaveNext(false);
    }
  };

  const handleNextNonLinear = async (step: any) => {
    setActiveStep(step);

    const breParametersDiv = document.querySelector('.bre_parameters_div');
    const stepperConfirmBre = document.querySelector('.stepper_confirmbre');
    const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
    const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
    const stepperNext = document.querySelector('.stepper_next');

    if (breParametersDiv) {
      breParametersDiv.classList.add('d-none');
    }
    if (stepperConfirmBre) {
      stepperConfirmBre.classList.add('d-none');
    }
    if (repaymentScheduleTableParametersDiv) {
      repaymentScheduleTableParametersDiv.classList.add('d-none');
    }
    if (stepperConfirmRepaymentScheduleTable) {
      stepperConfirmRepaymentScheduleTable.classList.add('d-none');
    }
    if (stepperNext) {
      stepperNext.classList.remove('d-none');
    }
  };

  const handleSave = async () => {
    setLoadingButton(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let success = await formToSubmit.current.submit();
      if (success) {
        scrollToTop();
        setSkipped(newSkipped);
        dispatch(
          updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
        );
        setStepsStatus((prevStepsStatus) => {
          const newStepsStatus = [...prevStepsStatus];
          newStepsStatus[activeStep] = "1";
          return newStepsStatus;
        });
      }
    } else {
      console.error("There is no form in the current page to submit.");
      scrollToTop();
      setSkipped(newSkipped);
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
    }
    setLoadingButton(false);
  };

  const handleBack = () => {
    setLoadingButton(true);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setLoadingButton(false);
  };

  const breadcrumbs = [
    <Link key="1" color="#A9A9A9" to="/">
      Loan Origination
    </Link>,
    <Link key="2" color="#A9A9A9" to="/lead">
      {leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead"}
    </Link>,
  ];

  return (
    <>
      <Snackbar
        open={stateAlert}
        autoHideDuration={3000}
        onClose={() => setStateAlert(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <AlertError
          icon={false}
          severity="error"
          onClose={() => console.log("close")}
        >
          {stateAlertMessage}
        </AlertError>
      </Snackbar>
      {activeStep === steps.length ? (
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
                You have successfully created
                <br />a new lead{" "}
                <span style={{ color: "#1377FF" }}>#{createdLeadId}</span>
              </Typography>
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
                    <Button
                      component={Link}
                      to="/"
                      className="no-underline login_forgot_password"
                      style={{
                        textDecoration: "none",
                        color: "#A9A9A9",
                        fontSize: "14px",
                      }}
                    >
                      {"< Back to Dashboard"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Grid>
        </React.Fragment>
      ) : (
        <div style={{ marginTop: "2.5em", marginBottom: "2.5em" }}>
          <Container maxWidth="xl">
            <div>
              <TitleHeader
                title={leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead"}
                breadcrumbs={breadcrumbs}
                button={buttons}
              />
            </div>

            <div style={{ marginTop: "1.5em" }}>
              <Box sx={{ width: "100%" }}>
                <Grid container spacing={3}>
                  <Grid item xl={3} lg={3.5} md={4} xs={4}>
                    {leadId && leadId !== "NEW" ? (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={true}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    ) : (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={false}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    )}
                  </Grid>

                  <Grid item xl={9} lg={8.5} md={8} xs={8}>
                    <div className="custom_scroll">
                      <React.Fragment>
                        {activeStep >= LEAD_GENERATION &&
                          activeStep < loanoriginationstep.length &&
                          React.createElement(loanoriginationstep[activeStep], {
                            ref: formToSubmit,
                          })}
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            pt: "22px",
                          }}
                        >
                          {activeStep === steps.length - 1 ? (
                            <Grid
                              container
                              spacing={3}
                              padding={0}
                              sx={{ mb: "32px" }}
                            >
                              <Grid item md={8} xs={12}>
                                <FormControlLabel
                                  value="end"
                                  control={
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={(e) =>
                                        setIsChecked(e.target.checked)
                                      }
                                    />
                                  }
                                  label={
                                    <Typography
                                      variant="body2"
                                      gutterBottom
                                      style={{
                                        marginTop: "0px",
                                        marginBottom: "0px",
                                        fontWeight: "400",
                                        color: "#3B415B",
                                      }}
                                    >
                                      I agree to the Terms and Condition{" "}
                                      <b>
                                        On behalf of the NBFC Authorised Person
                                      </b>
                                    </Typography>
                                  }
                                  labelPlacement="end"
                                />
                              </Grid>
                              <Grid
                                item
                                md={4}
                                xs={12}
                                sx={{ textAlign: "right" }}
                              >
                                <ColorButton
                                  variant="contained"
                                  onClick={handleSubmitLast}
                                  startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                  disabled={!isChecked && !loadingButton}
                                  className="stepSubmit"
                                >
                                  Submit
                                </ColorButton>
                              </Grid>
                            </Grid>
                          ) : (
                            <>
                              <ColorBackButton
                                color="inherit"
                                sx={{ mb: "32px" }}
                                onClick={handleBack}
                                startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                disabled={activeStep === 0 && loadingButton}
                                className="colorBackButton"
                              >
                                Back
                              </ColorBackButton>
                              <Box sx={{ flex: "1 1 auto" }} />
                              {isSaveApplicable(activeStep) ? (
                                <>
                                  <SaveColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleSave}
                                    startIcon={loadingButton ? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButton}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Save
                                  </SaveColorButton>
                                  <ColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleNext}
                                    startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButtonSaveNext}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Next
                                  </ColorButton>
                                </>
                              ) : (
                                <ColorButton
                                  variant="contained"
                                  className="stepper_next"
                                  onClick={handleNext}
                                  sx={{ mb: "32px" }}
                                  startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                  disabled={loadingButtonSaveNext}
                                >
                                  Save & Next
                                </ColorButton>
                              )}
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmbre d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                                startIcon={loadingButtonSaveNext ? <SpinningDotsWhite /> : ''}
                                disabled={loadingButtonSaveNext}
                              >
                                Confirm BRE
                              </ColorButton>
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmrepaymentschedule d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                              >
                                Confirm Repayment Schedule
                              </ColorButton>
                              <ColorCancelButton
                                variant="contained"
                                className="d-none"
                                sx={{ mb: "32px", ml: 1 }}
                              >
                                Cancel Application
                              </ColorCancelButton>
                            </>
                          )}
                        </Box>
                      </React.Fragment>
                    </div>
                  </Grid>
                </Grid>
              </Box>
            </div>
          </Container>
        </div>
      )}
    </>
  );
};

export default L0Container;

// Redux Slice (unchanged)
export enum StepStatus {
  SUCCESS,
  ERROR,
  SKIP,
}

interface LeadStore {
  id: number | undefined;
  stepStatus: StepStatus[];
}

const initialState: LeadStore = { id: undefined, stepStatus: [] };

export const leadStoreSlice = createSlice({
  name: "leadStore",
  initialState,
  reducers: {
    setLeadId: (state: LeadStore, action: PayloadAction<number>) => {
      state.id = action.payload;
    },
    updateStepStatus: (
      state: LeadStore,
      action: PayloadAction<{ step: number; status: StepStatus }>
    ) => {
      console.log("Updating step status", action.payload);
      if (action.payload.status === StepStatus.SKIP) {
        if (!state.stepStatus[action.payload.step]) {
          state.stepStatus[action.payload.step] = StepStatus.SKIP;
        }
      } else {
        state.stepStatus[action.payload.step] = action.payload.status;
      }
      console.log("Step Status");
      console.log(state.stepStatus?.map((item: any, index: number) => console.log(index, item)));
    },
  },
});

export const { setLeadId, updateStepStatus } = leadStoreSlice.actions;













import TitleHeader from "../../Components/titleheader";
import {
  Box,
  Grid,
  Container,  
  FormControlLabel,
  Checkbox,
  Typography,
  Paper,
  Snackbar,
  Button,
} from "@mui/material";
import { makeStyles } from "@material-ui/core/styles";
import useToken from "../../Features/Authentication/useToken";
import { skipToken } from "@reduxjs/toolkit/dist/query";
import { useNavigate } from "react-router-dom";
import { useGetLeadQuery } from "../../slices/leadSlice";
import AlertError from "../../Components/Framework/AlertError";
import "../../assets/css/common.css";
import VerticalStepper from "../../Components/verticalstepper";
import { useCallback, useEffect, useState } from "react";
import React from "react";
import {
  ColorBackButton,
  SkipColorButton,
  ColorButton,
  ColorCancelButton,
} from "./Buttons";
import SaveColorButton from "../../Components/Framework/ColorButton";
import LegalEntity from "./LegalEntity";
import Lead from "./Lead";
import { SubmitableForm } from "../../Components/Framework/FormSubmit";
import { useAppDispatch } from "../../app/hooks";
import {
  StepStatus,
  setLeadId,
  updateStepStatus,
} from "../../slices/localStores/leadStore";
import LoanDetails from "./LoanDetails";
import KmpContainer from "./KmpContainer";
import SecurityDetailsContainer from "./SecurityDetailsContainer";
import { useParams } from "react-router";
import Bre from "./Bre";
import RepaymentSchedule from "./RepaymentSchedule";
import ReviewAndSubmit from "./ReviewAndSubmit";
import SuccessAnimation from "../../Components/Framework/SuccessAnimation";
import { useUpdateLeadMutation } from "../../slices/leadSlice";
import { useAppSelector } from "../../app/hooks";
import { Link } from "react-router-dom";
import SaveIcon from '@mui/icons-material/Save';
import { ReactComponent as SpinningDotsWhite } from "../../assets/icons/spinning_dots_white.svg";
import { RequestWithParentId, SearchRequest } from "../../models/baseModels";
import { useListRpsOverallQuery, useListRpsSidbiQuery } from "../../slices/rpsListSlice";
import { Rps } from "../../models/rps";

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
  // input: {
  //   display: "none",
  // },
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

const L0Container = () => {
  const [loadingButton, setLoadingButton] = React.useState(false);
  const [loadingButtonSaveNext, setLoadingButtonSaveNext] = React.useState(false);

  const steps = [
    "LEAD GENERATION",
    "LEGAL ENTITY",
    "KEY MANAGEMENT PERSONNEL",
    "SECURITY DETAILS",
    "LOAN DETAILS",
    "BRE",
    "REPAYMENT SCHEDULE",
    "REVIEW & SUBMIT",
  ];

  const LEAD_GENERATION = 0;
  const LEGAL_ENTITY = 1;
  const KEY_MANAGEMENT_PERSONNEL = 2;
  const SECURITY_DETAILS = 3;
  // const LOAN_DETAILS = 3;
  // const FINNANCIAL_AND_OTHER_DOCS = 4;
  // const BRE = 5;
  // const REVIEW_AND_SUBMIT = 6;

  const dispatch = useAppDispatch();

  //Checking the status of the stepper.
  const { stepStatus } = useAppSelector((state) => state.leadStore);

  const buttons = [
    {
      label: "Save Progress and Close",
      buttonstyle: "secondary_outline",
      action: () => console.log("New button clicked"),
    },
  ];

  const classes = useStyles();
  const [activeStep, setActiveStep] = useState(LEAD_GENERATION);
  const [stepsStatus, setStepsStatus] = useState([
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
  ]);
  const [skipped, setSkipped] = useState(new Set());
  const [isChecked, setIsChecked] = useState(false);
  const formToSubmit = React.useRef<SubmitableForm>(null);
  const [stateAlert, setStateAlert] = useState(false);
  const [stateAlertMessage, setStateAlertMessage] = useState("");
  const [completed] = React.useState<{
    [k: number]: boolean;
  }>({});
  // const [completedState] = useState(false);
  // const [completedStateActiveStep] = useState(-1);

  
  // const handleComplete = (activeStep:  any) => {
  //   if(completedStateActiveStep !== -1 && completedState === true) {
  //     const newCompleted = completed;
  //     newCompleted[activeStep] = true;
  //     setCompleted(newCompleted);
  //   }
  // };

  const [updateLeadStatus] = useUpdateLeadMutation();

  //On new lead creation the created Lead ID is stored
  //in the redux store to be used by all components.
  const { id: leadId } = useParams();
  const { data: leadDataFetch } = useGetLeadQuery(Number(leadId) || skipToken);
  const navigate = useNavigate();
  const { getRoles } = useToken();
  const setLeadIdRef = useCallback(
    (id: number) => dispatch(setLeadId(id)),
    [dispatch]
  );
  useEffect(() => {
    if (leadId) setLeadIdRef(Number(leadId));
    if(leadDataFetch !== undefined){
      if(leadDataFetch?.sidbiStatus !== "CREATION" && getRoles().find((e: string) => e !== "NBFC")){
        navigate("/restricted");
      }
    }
  }, [leadId, setLeadIdRef, leadDataFetch]);

  const { id: createdLeadId } = useAppSelector((state) => state.leadStore);

  const loanoriginationstep = [
    Lead,
    LegalEntity,
    KmpContainer,
    SecurityDetailsContainer,
    LoanDetails,
    Bre,
    RepaymentSchedule,
    ReviewAndSubmit,
  ];

  // const isStepOptional = (step: any) => {
  //   if (step === LEGAL_ENTITY) {
  //     return 1;
  //   } else if (step === KEY_MANAGEMENT_PERSONNEL) {
  //     return 1;
  //   }
  // };

  const isSaveApplicable = (step: any) => {
    if (step === KEY_MANAGEMENT_PERSONNEL) {
      return 1;
    } else if (step === SECURITY_DETAILS) {
      return 1;
    }
  };

  const isStepSkipped = (step: any) => {
    return skipped.has(step);
  };

  const handleSubmitLast = () => {    
    setLoadingButton(true);

    if (skipped.size > 0) {
      setStateAlert(true);
      setStateAlertMessage("Please complete all the steps");
    } else {
      if (Number(createdLeadId))
        updateLeadStatus({
          id: Number(createdLeadId),
          leadStatus: "IN_PROCESS",
          sidbiStatus: "ORIGINATION",
        }).unwrap().then((data) => {
          if(data.leadStatus === 'IN_PROCESS') {
            let newSkipped = skipped;
            if (isStepSkipped(activeStep)) {
              newSkipped = new Set(newSkipped.values());
              newSkipped.delete(activeStep);
            }

            setActiveStep((prevActiveStep) => prevActiveStep + 1);
            setSkipped(newSkipped);
            scrollToTop(); // Scroll to top when Constitution value changes
          } else {
            alert("Unknown error, please contact support.");
          }
          
        });
    }
  };

  const scrollToTop = () => {
    const customScrollDiv = document.querySelector(".custom_scroll");
    if (customScrollDiv) {
      customScrollDiv.scrollTo({
        top: 0,
        behavior: "smooth", // Optional smooth scrolling behavior
      });
    }
  };
  const [nextProceed, setNextProceed] = useState(false);
  const [nextRPSDataProceed, setNextRPSDataProceed] = useState(false);
  const rpsInput: RequestWithParentId<SearchRequest<Rps>> = {
    parentId: Number(leadId) || 0,
    requestValue: {},
  };

  const { data: overall } = useListRpsOverallQuery(rpsInput);
  const { data: sidbi } = useListRpsSidbiQuery(rpsInput);
  useEffect(() => {
    if (
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length === 0) ||
       (Array.isArray(sidbi) && sidbi.length === 0))
    ) {
      setNextProceed(true);
    } if(
      activeStep === 5 &&
      ((Array.isArray(overall) && overall.length > 0) ||
       (Array.isArray(sidbi) && sidbi.length > 0))
    ){
      setNextRPSDataProceed(true);
      
			const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
			const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
			// const repaymentScheduleTableUploadDiv = document.querySelector('.repaymentScheduleTable_upload_div');
			const stepperNext = document.querySelector('.stepper_next');

			// setIsHeading("Repayment Schedule");
			// setIsSubHeading(true);
			if (repaymentScheduleTableParametersDiv) {
			repaymentScheduleTableParametersDiv.classList.remove('d-none');
			}
			if (stepperConfirmRepaymentScheduleTable) {
			stepperConfirmRepaymentScheduleTable.classList.remove('d-none');
			}
    } else {
      setNextProceed(false);
    }
  }, [activeStep, overall, sidbi]);
  console.log(nextProceed);

  const handleNext = async () => {    
    setLoadingButtonSaveNext(true);

    let newSkipped = skipped;
    console.log(activeStep);
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    

    if (formToSubmit && formToSubmit.current) {
      let isValidForm = formToSubmit.current && await formToSubmit.current.isValid();
      if(isValidForm) {
        console.log("Calling Submit in next")
        await formToSubmit.current?.submit();
        console.log("Submitted in next")
        let success = await formToSubmit.current?.isValid(true);
        console.log("is Valid in form submit", success)
        // if(activeStep === 1){
  
        // } else {
          // let success = await formToSubmit.current?.submit();
  
          if (success) {
            setActiveStep((prevActiveStep) => prevActiveStep + 1);
            setSkipped(newSkipped);
            dispatch(
              updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS })
            );
          }
  
          scrollToTop(); // Scroll to top on new step display
  
          // Update steps_status array
          setStepsStatus((prevStepsStatus) => {
            const newStepsStatus = [...prevStepsStatus];
            newStepsStatus[activeStep] = "1";
            return newStepsStatus;
          });
      } else {
        scrollToTop(); // Scroll to top on new step display
      }
      // }
      setLoadingButtonSaveNext(false);
    } else {
      console.error("There is no form in the current page to submit.");

      //For debugging
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      scrollToTop(); // Scroll to top on new step display
      setSkipped(newSkipped);

      scrollToTop(); // Scroll to top on new step display
      
      // Update steps_status array
      setStepsStatus((prevStepsStatus) => {
        const newStepsStatus = [...prevStepsStatus];
        newStepsStatus[activeStep] = "1";
        return newStepsStatus;
      });
      setLoadingButtonSaveNext(false);
    }
  };

  const handleNextNonLinear = async (step: any) => {
    setActiveStep(step);

		const breParametersDiv = document.querySelector('.bre_parameters_div');
		const stepperConfirmBre = document.querySelector('.stepper_confirmbre');
		const repaymentScheduleTableParametersDiv = document.querySelector('.repaymentScheduleTable_parameters_div');
		const stepperConfirmRepaymentScheduleTable = document.querySelector('.stepper_confirmrepaymentschedule');
		const stepperNext = document.querySelector('.stepper_next');

		if (breParametersDiv) {
			breParametersDiv.classList.add('d-none');
		}
		if (stepperConfirmBre) {
			stepperConfirmBre.classList.add('d-none');
		}
		if (repaymentScheduleTableParametersDiv) {
			repaymentScheduleTableParametersDiv.classList.add('d-none');
		}
		if (stepperConfirmRepaymentScheduleTable) {
			stepperConfirmRepaymentScheduleTable.classList.add('d-none');
		}
		if (stepperNext) {
			stepperNext.classList.remove('d-none');
		}
  };

  const handleSave = async () => {
    setLoadingButton(true);

    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    if (formToSubmit && formToSubmit.current) {
      let success = await formToSubmit.current?.submit();

      if (success) {
        // setActiveStep((prevActiveStep) => prevActiveStep + 1);
        scrollToTop(); // Scroll to top on new step display
        setSkipped(newSkipped);
        dispatch(
          updateStepStatus({ step: activeStep, status: StepStatus.SUCCESS, })
        );
        setLoadingButton(false);
      }
    } else {
      console.error("There is no form in the current page to submit.");

      //For debugging
      // setActiveStep((prevActiveStep) => prevActiveStep + 1);
      scrollToTop(); // Scroll to top on new step display
      setSkipped(newSkipped);
      setLoadingButton(false);
    }

    // Update steps_status array
    setStepsStatus((prevStepsStatus) => {
      const newStepsStatus = [...prevStepsStatus];
      newStepsStatus[activeStep] = "1";
      return newStepsStatus;
    });
    setLoadingButton(false);
    // handleNext();
  };

  const handleBack = () => {
    setLoadingButton(true);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setLoadingButton(false);
  };

  // const handleSkip = () => {
  //   if (!isStepOptional(activeStep)) {
  //     // You probably want to guard against something like this,
  //     // it should never occur unless someone's actively trying to break something.
  //     throw new Error("You can't skip a step that isn't optional.");
  //   }

  //   setSkipped((prevSkipped) => {
  //     const newSkipped = new Set(prevSkipped.values());
  //     newSkipped.add(activeStep);
  //     return newSkipped;
  //   });

  //   // Update steps_status array
  //   setStepsStatus((prevStepsStatus) => {
  //     const newStepsStatus = [...prevStepsStatus];
  //     newStepsStatus[activeStep] = "2";
  //     return newStepsStatus;
  //   });

  //   dispatch(updateStepStatus({ step: activeStep, status: StepStatus.SKIP }));

  //   setActiveStep((prevActiveStep) => prevActiveStep + 1);
  //   scrollToTop(); // Scroll to top when Constitution value changes
  // };

  // const handleNextStep = () => {
  //   setActiveStep((prevActiveStep) => prevActiveStep + 1);
  //   scrollToTop(); // Scroll to top when Constitution value changes
  //   // Update steps_status array
  //   setStepsStatus((prevStepsStatus) => {
  //     const newStepsStatus = [...prevStepsStatus];
  //     newStepsStatus[activeStep] = "1";
  //     return newStepsStatus;
  //   });
  // };

  const breadcrumbs = [
    <Link key="1" color="#A9A9A9" to="/">
      Loan Origination
    </Link>,
    <Link key="1" color="#A9A9A9" to="/lead">
      {leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead" }
    </Link>,
  ];
  // const stepsSample = [
  //   {
  //     name: "Step Name",
  //     description: "Short step description",
  //     active: false,
  //     completed: false,
  //   },
  // ];
  return (
    <>
      <Snackbar
        open={stateAlert}
        autoHideDuration={3000}
        onClose={() => setStateAlert(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <AlertError
          icon={false}
          severity="error"
          onClose={() => console.log("close")}
        >
          {stateAlertMessage}
        </AlertError>
      </Snackbar>
      {activeStep === steps.length ? (
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
                You have successfully created
                <br />a new lead{" "}
                <span style={{ color: "#1377FF" }}>#{createdLeadId}</span>
              </Typography>
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
            </Box>
          </Grid>
        </React.Fragment>
      ) : (
        <div style={{ marginTop: "2.5em", marginBottom: "2.5em" }}>
          <Container maxWidth="xl">
            <div>
              <TitleHeader
                title={leadId && leadId !== "NEW" ? "Edit New Lead" : "Create New Lead" }
                breadcrumbs={breadcrumbs}
                button={buttons}
              />
            </div>

            <div style={{ marginTop: "1.5em" }}>
              {/* <div className="stepper" style={{ marginBottom: "1.5em" }}>
                {stepsSample.map((step, index) => (
                  <div
                    className={`step ${step.active ? "active" : ""} ${
                      completed ? "completed" : ""
                    }`}
                  >
                   <div className="chevronWhite"></div>
                    <div className="step-content">
                      <div className="step-name">{step.name}</div>
                      <div className="step-description">{step.description}</div>
                    </div>
                    <div className="chevron"></div>
                  </div>
                ))}
              </div> */}
              <Box sx={{ width: "100%" }}>
                <Grid container spacing={3}>
                  <Grid item xl={3} lg={3.5} md={4} xs={4}>
                    {leadId && leadId !== "NEW" ? (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={true}
                        // nonLinearStatus={false}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    ) : (
                      <VerticalStepper
                        activeStep={activeStep}
                        steps={steps}
                        stepsStatus={stepsStatus}
                        setActiveStep={setActiveStep}
                        nonLinearStatus={false}
                        handleNextNonLinear={handleNextNonLinear}
                        completed={completed}
                      />
                    )}
                  </Grid>

                  <Grid item xl={9} lg={8.5} md={8} xs={8}>
                    <div className="custom_scroll">
                      <React.Fragment>
                        {activeStep >= LEAD_GENERATION &&
                          activeStep < loanoriginationstep.length &&
                          React.createElement(loanoriginationstep[activeStep], {
                            ref: formToSubmit,
                          })}
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            pt: "22px",
                          }}
                        >
                          {activeStep === steps.length - 1 ? (
                            <Grid
                              container
                              spacing={3}
                              padding={0}
                              sx={{ mb: "32px" }}
                            >
                              <Grid item md={8} xs={12}>
                                <FormControlLabel
                                  value="end"
                                  control={
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={(e) =>
                                        setIsChecked(e.target.checked)
                                      }
                                    />
                                  }
                                  label={
                                    <Typography
                                      variant="body2"
                                      gutterBottom
                                      style={{
                                        marginTop: "0px",
                                        marginBottom: "0px",
                                        fontWeight: "400",
                                        color: "#3B415B",
                                      }}
                                    >
                                      I agree to the Terms and Condition{" "}
                                      <b>
                                        On behalf of the NBFC Authorised Person
                                      </b>
                                    </Typography>
                                  }
                                  labelPlacement="end"
                                />
                              </Grid>
                              <Grid
                                item
                                md={4}
                                xs={12}
                                sx={{ textAlign: "right" }}
                              >
                                <ColorButton
                                  variant="contained"
                                  onClick={handleSubmitLast}
                                  startIcon={loadingButton? <SpinningDotsWhite /> : ''}
                                  disabled={!isChecked && !loadingButton}
                                  className="stepSubmit"
                                >
                                  Submit
                                </ColorButton>
                              </Grid>
                            </Grid>
                          ) : (
                            <>
                              <ColorBackButton
                                color="inherit"
                                sx={{ mb: "32px" }}
                                onClick={handleBack}
                                startIcon={loadingButton? <SpinningDotsWhite /> : ''}
                                disabled={activeStep === 0 && loadingButton}
                                className="colorBackButton"
                              >
                                Back
                              </ColorBackButton>
                              <Box sx={{ flex: "1 1 auto" }} />
                              {/* {isStepOptional(activeStep) && (
                                <SkipColorButton
                                  variant="contained"
                                  sx={{ mb: "32px", mr: "12px" }}
                                  onClick={handleSkip}
                                >
                                  Skip
                                </SkipColorButton>
                              )} */}
                              {isSaveApplicable(activeStep) ? (
                                <>
                                  <SaveColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleSave}
                                    startIcon={loadingButton? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButton}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Save
                                  </SaveColorButton>
                                  <ColorButton
                                    variant="contained"
                                    className="stepper_next"
                                    onClick={handleNext}
                                    startIcon={loadingButtonSaveNext? <SpinningDotsWhite /> : ''}
                                    disabled={loadingButtonSaveNext}
                                    sx={{ mb: "32px", mr: "12px" }}
                                  >
                                    Next
                                  </ColorButton>
                                </>
                              ) : (
                                <ColorButton
                                  variant="contained"
                                  className="stepper_next"
                                  onClick={handleNext}
                                  sx={{ mb: "32px" }}
                                  startIcon={loadingButtonSaveNext? <SpinningDotsWhite /> : ''}
                                  disabled={loadingButtonSaveNext}
                                >
                                  Save & Next
                                </ColorButton>
                              )}
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmbre d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                                startIcon={loadingButtonSaveNext? <SpinningDotsWhite /> : ''}
                                disabled={loadingButtonSaveNext}
                              >
                                Confirm BRE
                              </ColorButton>
                              <ColorButton
                                variant="contained"
                                className="stepper_confirmrepaymentschedule d-none"
                                sx={{ mb: "32px" }}
                                onClick={handleNext}
                              >
                                Confirm Repayment Schedule
                              </ColorButton>
                              <ColorCancelButton
                                variant="contained"
                                className="d-none"
                                sx={{ mb: "32px", ml: 1 }}
                              >
                                Cancel Application
                              </ColorCancelButton>
                            </>
                          )}
                        </Box>
                      </React.Fragment>
                    </div>
                  </Grid>
                </Grid>
              </Box>
            </div>
          </Container>
        </div>
      )}
    </>
  );
};

export default L0Container;

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum StepStatus {
  SUCCESS,
  ERROR,
  SKIP,
}

interface LeadStore {
  id: number | undefined;
  stepStatus: StepStatus[];
}

const initialState: LeadStore = { id: undefined, stepStatus: [] };

export const leadStoreSlice = createSlice({
  name: "leadStore",
  initialState,
  reducers: {
    setLeadId: (state: LeadStore, action: PayloadAction<number>) => {
      state.id = action.payload;
    },
    updateStepStatus: (
      state: LeadStore,
      action: PayloadAction<{ step: number; status: StepStatus }>
    ) => {
      console.log("Updating step status", action.payload);
      if (
        action.payload.status === StepStatus.SKIP
      ) {
        //If the form is skipped preserve the original status of the form
        if(!state.stepStatus[action.payload.step]) {
          state.stepStatus[action.payload.step] = StepStatus.SKIP;
        }
      } else {
        state.stepStatus[action.payload.step] = action.payload.status;
      }
      console.log("Step Status")
      console.log(state.stepStatus?.map((item: any, index: number) => console.log(index, item)));
    },
  },
});

export const { setLeadId, updateStepStatus } = leadStoreSlice.actions;


