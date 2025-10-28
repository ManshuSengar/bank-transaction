import React, { useEffect, useState } from 'react';
import {
  Grid,
  Divider,
  Button,
  Tooltip,
  Tabs,
  Tab,
  Box,
  Fade,
  Alert,
  Snackbar,
  Typography
} from '@mui/material';
import { Formik, Form, FormikProps } from 'formik';
import ErrorMessageGlobal from '../../../components/framework/ErrorMessageGlobal';
import { TextBoxField } from '../../../components/framework/TextBoxField';
import { PnfTextBoxField } from "../components/PnfTextBoxField";
import { defaultPnfInformation, pnfInformationSchema } from '../../../models/pnf/pnf';
import {
  useAddPnfMutation,
  useGetPnfQuery,
  useGetPnfEmailStatusQuery,
  useLazyPnfReportQuery,
  useLazyGetPnfQuery
} from '../../../features/pnf/api';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { setDrawerState, setPnfStatus } from '../../../features/lead/leadSlice';
import { useLocation, useNavigate } from 'react-router-dom';
import { AiOutlineArrowLeft, AiOutlineFilePdf } from "react-icons/ai";
import { MirPnfDropdown } from "../components/MirPnfDropdown"; // NEW
import Section from '../../nbfc/Section';
import Workflow from '../../workflow/Workflow';
import { TabPanelProps } from "../../../models/tabPanel";
import SaveAsIcon from '@mui/icons-material/SaveAs';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { UploadAPI } from '../../../features/upload/upload';
import BrowserUpdatedIcon from '@mui/icons-material/BrowserUpdated';
import MultiFileUpload from '../../marketIntelligenceSheet/components/MultipleFileUpload';
import { useGetOldWorkflowDetailsQuery, useLazyGetWorkflowDetailsQuery } from '../../../features/workflow/api';
import NbfcSnackbar from '../../../components/shared/NbfcSnackbar';
import { OldWorkFlowMain } from '../../workflow/OldWorkFlowMain';
import { PANInputField } from '../../../components/framework/PANInputField';
import AutoSave from '../../../components/framework/AutoSave';
import { TextAreaField } from '../../../components/framework/TextAreaAuto';
import Cookies from 'js-cookie';
import { setPNFIdData } from '../../../features/user/userSlice';
import FullScreenLoaderNoClose from '../../../components/common/FullScreenLoaderNoClose';

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      className="wrap-tab-container py-2"
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const PnfForm = () => {
  const { pnfId } = useAppSelector((state: any) => state.userStore);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [value, setValue] = useState(0);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [severity, setSeverity] = useState<"success" | "error">("success");
  const [isManualSave, setIsManualSave] = useState(false);
  const [newFiles, setNewFiles] = useState<any>([]);
  const [isNew, setIsNew] = useState<boolean>(true);

  const { data: initialData, isLoading: isInitialLoading, refetch: refetchPnfData } = useGetPnfQuery(pnfId, {
    skip: !pnfId,
    refetchOnMountOrArgChange: true
  });

  const { userData } = useAppSelector((state: any) => state.userStore);
  const { data: oldWorkflowDetails } = useGetOldWorkflowDetailsQuery(
    { formId: pnfId, formType: "PNF" },
    { skip: !pnfId, refetchOnMountOrArgChange: true }
  );

  const [getPnfData] = useLazyGetPnfQuery();
  const [checkWorkFlow] = useLazyGetWorkflowDetailsQuery();
  const [generateReport] = useLazyPnfReportQuery();
  const [addPnf] = useAddPnfMutation();

  const loginCookiesData = JSON.parse(Cookies.get("user") || "{}");

  useEffect(() => {
    if (location.pathname.includes('pnf')) {
      dispatch(setDrawerState(false));
    }
    if (location?.state?.id) {
      dispatch(setPNFIdData(location.state.id));
    }
  }, [location, dispatch]);

  const handleButtonClick = async (
    status: "01" | "02",
    formikProps: FormikProps<any>
  ) => {
    const { values, validateForm, setSubmitting } = formikProps;
    setIsManualSave(true);

    const errors = await validateForm();
    if (Object.keys(errors).length > 0) {
      setOpenSnackbar(true);
      setSeverity("error");
      setSnackMsg("Please fix form errors.");
      setSubmitting(false);
      setIsManualSave(false);
      return;
    }

    try {
      if (status === "02") {
        const workflowDetails = await checkWorkFlow({ formId: pnfId, formType: "PNF" }).unwrap();
        if (!workflowDetails || workflowDetails.length < 2) {
          setOpenSnackbar(true);
          setSeverity("error");
          setSnackMsg("Please assign workflow before submitting.");
          setSubmitting(false);
          setIsManualSave(false);
          return;
        }
      }

      let responseId = pnfId;
      const payload = {
        ...values,
        pnfId: pnfId || undefined,
        status,
        makerId: userData?.userId,
        pnfDoc: newFiles
      };

      const response: any = pnfId
        ? await addPnf({ ...payload, pnfId }).unwrap()
        : await addPnf(payload).unwrap();

      responseId = response?.pnfId;
      if (!pnfId) {
        dispatch(setPNFIdData(responseId));
      }

      for (const file of newFiles) {
        await UploadAPI.updateDoc({ pnfId: responseId, slNo: file.slNo }, "/pnf/updatePnfDoc");
      }
      await getPnfData(responseId).unwrap();

      setIsNew(false);
      dispatch(setPnfStatus(status));

      setOpenSnackbar(true);
      setSeverity("success");
      setSnackMsg(status === "01" ? "Saved as draft!" : "PNF Submitted Successfully!");

    } catch (error: any) {
      setOpenSnackbar(true);
      setSeverity("error");
      setSnackMsg(error?.data?.message || "Operation failed.");
    } finally {
      setSubmitting(false);
      setIsManualSave(false);
    }
  };

  const handleAutoSave = async (values: any) => {
    try {
      let responseId = pnfId;
      const payload = {
        ...values,
        pnfId: pnfId || undefined,
        status: "01",
        makerId: userData?.userId,
        pnfDoc: newFiles
      };

      const response: any = pnfId
        ? await addPnf({ ...payload, pnfId }).unwrap()
        : await addPnf(payload).unwrap();

      responseId = response?.pnfId;
      if (!pnfId) dispatch(setPNFIdData(responseId));

      for (const file of newFiles) {
        await UploadAPI.updateDoc({ pnfId: responseId, slNo: file.slNo }, "/pnf/updatePnfDoc");
      }

      setIsNew(false);
      return true;
    } catch (error) {
      console.error("Auto-save failed:", error);
      return false;
    }
  };

  const handleViewReport = async () => {
    try {
      const reportData: any = await generateReport(pnfId).unwrap();
      const byteCharacters = atob(reportData?.repData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url);
    } catch (error) {
      setOpenSnackbar(true);
      setSeverity("error");
      setSnackMsg("Failed to generate report.");
    }
  };

  useEffect(() => {
    if (value === 0 && pnfId) refetchPnfData();
  }, [value, pnfId, refetchPnfData]);

  if (isManualSave) return <FullScreenLoaderNoClose />;

  return (
    <Grid container className="los_mainwra">
      <Grid item xs={12} className="los_rgtdata">
        <div className="wrap-appraisal-area">
          <Section>
            <Box className="wrap-tabs" sx={{ width: '100%' }}>
              <Box className="tab-with-btn ps-0" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tooltip arrow TransitionComponent={Fade} TransitionProps={{ timeout: 600 }} title="Back to PNF Dashboard" placement="top">
                  <Button variant="outlined" color="inherit" size="small" onClick={() => navigate("/los/pnf-dashboard")}>
                    <AiOutlineArrowLeft className="me-0" /> Back
                  </Button>
                </Tooltip>
                <Tabs className="tabs-header" value={value} onChange={(_, v) => setValue(v)} aria-label="pnf tabs">
                  <Tab className="tab-ui" label="PNF Form" {...a11yProps(0)} />
                  <Tab className="tab-ui" label="Workflow" {...a11yProps(1)} />
                  {oldWorkflowDetails?.length > 0 && <Tab className="tab-ui" label="Workflow History" {...a11yProps(2)} />}
                </Tabs>
              </Box>

              <CustomTabPanel value={value} index={0}>
                <ErrorMessageGlobal status={null} />
                <Section>
                  <div className='custome-form'>
                    <div className='d-flex justify-content-end mb-3'>
                      {pnfId ? (
                        <Button
                          variant="contained"
                          size="small"
                          className="text-capitalize shadow-none search-color"
                          onClick={handleViewReport}
                          startIcon={<AiOutlineFilePdf />}
                        >
                          View Report
                        </Button>
                      ) : (
                        <Button variant="contained" size="small" disabled>
                          <AiOutlineFilePdf /> &nbsp;Fill details to view report
                        </Button>
                      )}
                    </div>

                    <Formik
                      initialValues={initialData || defaultPnfInformation}
                      validationSchema={pnfInformationSchema}
                      onSubmit={() => { }}
                      enableReinitialize
                    >
                      {formikProps => {
                        const { values, isSubmitting } = formikProps;
                        const canEdit = (values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker";

                        // Email check inside Formik
                        const { data: emailValue, isFetching: checkingEmail } = useGetPnfEmailStatusQuery(
                          { id: values.nominationEmailId, pnfId },
                          { skip: !values.nominationEmailId || !pnfId }
                        );

                        const isEmailDuplicate = emailValue === true;
                        const blockSave = isSubmitting || isEmailDuplicate;

                        return (
                          <Form>
                            {canEdit && (
                              <AutoSave
                                debounceMs={5000}
                                handleSubmit={async (vals) => {
                                  if (isEmailDuplicate) return false;
                                  return handleAutoSave(vals);
                                }}
                                values={values}
                              />
                            )}

                            <Grid container spacing={2} padding={4} className='form-grid pt-0 pb-0'>
                              <Grid item xs={12}>
                                <Divider className='mt-0 mb-3' textAlign="left">
                                  <span className='seperator-ui'>MIR Details</span>
                                </Divider>
                              </Grid>

                              <Grid item xs={12} sm={6} md={3} lg={4}>
                                <MirPnfDropdown
                                  label="Select MIR: *"
                                  name="mirId"
                                  disabled={!canEdit}
                                />
                              </Grid>

                              <Grid item xs={12} sm={6} md={3} lg={4}>
                                <TextBoxField label="Name of Borrower: *" name="customerName" disabled={!canEdit} />
                              </Grid>

                              <Grid item xs={12} sm={6} md={3} lg={4}>
                                <PANInputField label="PAN" name="pan" isRequired disabled={!canEdit} />
                              </Grid>

                              <Grid item xs={12}>
                                <TextAreaField
                                  label="Nature of Business: *"
                                  name="businessNature"
                                  disabled={!canEdit}
                                  maxLength={500}
                                  restrictedCharacters="¿"
                                />
                              </Grid>

                              <Grid item xs={12}>
                                <Divider className='mt-4 mb-3' textAlign="left">
                                  <span className='seperator-ui'>Details of Nominated Personnel</span>
                                </Divider>
                                <Alert severity="warning" className='mb-3'>
                                  <strong>Note:</strong> User ID will be generated from the <strong>Official Email Id</strong> field.
                                </Alert>
                              </Grid>

                              <Grid item xs={12} lg={3}>
                                <TextBoxField label="Name *" name="nominationName" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={3}>
                                <TextBoxField label="Type of Employee" name="nominationType" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={3}>
                                <TextBoxField label="Designation *" name="nominationDesgn" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={3}>
                                <TextBoxField label="Employee ID *" name="nominationEmpId" disabled={!canEdit} />
                              </Grid>

                              <Grid item xs={12} lg={2}>
                                <PnfTextBoxField
                                  name="nominationEmailId"
                                  label="Official Email Id *"
                                  disabled={!canEdit}
                                />
                                {checkingEmail ? (
                                  <Typography variant="caption" color="textSecondary">Checking...</Typography>
                                ) : isEmailDuplicate ? (
                                  <Typography color="error" variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                    This email is already in use.
                                  </Typography>
                                ) : null}
                              </Grid>

                              <Grid item xs={12} lg={2}>
                                <TextBoxField label="Mobile No *" name="nominationMobileNo" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={2}>
                                <PANInputField label="PAN Number *" name="nominationPan" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField label="Authorized By" name="nominationAuthBy" disabled={!canEdit} />
                              </Grid>

                              <Grid item xs={12}>
                                <Divider className='mt-4 mb-3' textAlign="left">
                                  <span className='seperator-ui'>Details of Authorized Signatory</span>
                                </Divider>
                              </Grid>

                              <Grid item xs={12} lg={4}>
                                <TextBoxField label="Name *" name="authName" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField label="Type of Employee" name="authType" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField label="Designation *" name="authDesgn" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField label="Employee ID *" name="authEmpId" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField label="Acting on Behalf of *" name="authBehalf" disabled={true} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField label="Official Email Id *" name="authEmailId" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField label="Official Mobile No *" name="authMobileNo" disabled={!canEdit} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <PANInputField label="PAN Number *" name="authPan" isRequired disabled={!canEdit} />
                              </Grid>

                              <Grid item xs={6} className='pt-3'>
                                <MultiFileUpload
                                  initialFiles={values.pnfDoc || []}
                                  onFileChange={setNewFiles}
                                  disabled={!canEdit}
                                  isNew={isNew}
                                  isFrom='pnf'
                                />
                              </Grid>

                              <Grid item xs={12} textAlign="right">
                                {canEdit && (
                                  <>
                                    <Button
                                      variant="contained"
                                      size="small"
                                      className="text-capitalize sbmtBtn me-2"
                                      onClick={() => handleButtonClick("01", formikProps)}
                                      disabled={blockSave}
                                    >
                                      {initialData ? <>Save <BrowserUpdatedIcon /></> : <>Save as Draft <SaveAsIcon /></>}
                                    </Button>

                                    {initialData && (
                                      <Button
                                        variant="contained"
                                        size="small"
                                        className="text-capitalize sbmtBtn sbmtBtn_scn"
                                        onClick={() => handleButtonClick("02", formikProps)}
                                        disabled={blockSave}
                                      >
                                        Submit <CheckCircleIcon />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </Grid>
                            </Grid>
                          </Form>
                        );
                      }}
                    </Formik>
                  </div>
                </Section>
              </CustomTabPanel>

              <CustomTabPanel value={value} index={1}>
                <Workflow formIdVal={pnfId} formTypeVal={'PNF'} />
              </CustomTabPanel>

              {oldWorkflowDetails?.length > 0 && (
                <CustomTabPanel value={value} index={2}>
                  <OldWorkFlowMain value={value} oldWorkflowDetails={oldWorkflowDetails} />
                </CustomTabPanel>
              )}
            </Box>
          </Section>
        </div>

        <NbfcSnackbar
          open={openSnackbar}
          msg={snackMsg}
          severity={severity}
          handleSnackClose={() => setOpenSnackbar(false)}
          submitCall={false}
        />
      </Grid>
    </Grid>
  );
};

export default PnfForm;


// components/MirPnfDropdown.tsx
import React, { useEffect, useMemo } from "react";
import { Grid, TextField, Autocomplete, Typography } from "@mui/material";
import { getIn, useFormikContext } from "formik";
import { useGetMaterQuery } from "../../../features/master/api";
import { useGetMirQuery } from "../../../features/mir/api";
import { modify } from "../../../utlis/helpers";

export const MirPnfDropdown = (props: {
  label?: string;
  name: string;
  disabled?: boolean;
}) => {
  const { setFieldValue, values, touched, errors, handleBlur } = useFormikContext<any>();

  const { data: masterData, isLoading: isMasterLoading } = useGetMaterQuery(
    `refapi/mir/getMirPnfList`,
    { refetchOnMountOrArgChange: true }
  );

  const selectedMirId = getIn(values, props.name);
  const { data: mirInfo, isLoading: isMirLoading } = useGetMirQuery(selectedMirId, {
    skip: !selectedMirId
  });

  const options = useMemo(() => {
    return modify("mir/getMirPnfList", masterData)?.map((item: any) => ({
      key: item.key,
      value: item.key,
      label: item.label
    })) || [];
  }, [masterData]);

  useEffect(() => {
    if (mirInfo) {
      setFieldValue("customerName", mirInfo.nbfcName || mirInfo.customerDetails);
      setFieldValue("pan", mirInfo.panNo);
      setFieldValue("businessNature", mirInfo.businessNature);
      setFieldValue("authBehalf", mirInfo.nbfcName);
      setFieldValue("cifCd", mirInfo.cifCd);
      setFieldValue("nbfcId", mirInfo.nbfcId);
    }
  }, [mirInfo, setFieldValue]);

  const currentValue = options.find(opt => opt.value == selectedMirId) || null;

  return (
    <Grid item xs={12}>
      <Autocomplete
        fullWidth
        options={options}
        value={currentValue}
        disabled={props.disabled || isMasterLoading}
        loading={isMasterLoading || isMirLoading}
        onChange={(_, newValue) => {
          setFieldValue(props.name, newValue ? newValue.value : null);
        }}
        onBlur={handleBlur}
        getOptionLabel={(option) => option.label}
        renderInput={(params) => (
          <TextField
            {...params}
            label={props.label}
            variant="outlined"
            error={Boolean(getIn(touched, props.name) && getIn(errors, props.name))}
            helperText={
              getIn(touched, props.name) && getIn(errors, props.name)
                ? JSON.stringify(getIn(errors, props.name)).replaceAll('"', "")
                : ""
            }
          />
        )}
        isOptionEqualToValue={(option, value) => option.value === value.value}
      />
    </Grid>
  );
};









//solution 
if(formToSubmit.current) 
        {
          let isValidToSubmit = await formToSubmit.current.isValid();

          if(isValidToSubmit) {
            // Get current form values
            const values = formToSubmit.current.getValues() as KeyManagemetPersonnel;

            // Prepare fraud check input
            const fraudInput: RequestWithParentId<KeyManagemetPersonnel> = {
              parentId: leadId || 0,
              requestValue: values,
            };

            try {
              // Call fraud check API
              const fraudResult = await checkKmpFraud(fraudInput).unwrap();

              if (fraudResult.isFraud) {
                setValidationMessage(fraudResult.message || "This is a fraud case. Cannot proceed.");
                return false;
              }
            } catch (fraudError) {
              console.error("Fraud check error:", fraudError);
              setValidationMessage("Error during fraud check. Please try again.");
              return false;
            }

            // Proceed with submit if no fraud
            await formToSubmit.current.submit();
            let response = await validateAllKmps();
            console.log("validateAllKmps: ", response);
            return response;
          } else {
            return false;
          }
        }
      } 

      return false;
		},
  
		//2. Check is dirty
		isDirty() {
      if(formToSubmit.current) 
      {
        return formToSubmit.current.isDirty();
      }

      return false;
    },















import React, { useEffect, useState } from "react";
import { SubmitableForm } from "../../Components/Framework/FormSubmit";
import {
  useDeleteKmpMutation,
  useListKmpsQuery,
} from "../../slices/keyManagementPersonnelSlice";
import { RequestWithParentId, SearchRequest } from "../../models/baseModels";
import { KeyManagemetPersonnel } from "../../models/keyManagementPersonnel";
import { CircularProgress, Typography } from "@material-ui/core";
import { Chip, Grid } from "@mui/material";
import { useAppSelector } from "../../app/hooks";
import KeyManagemetPersonnelComponent from "./KeyManagemetPersonnelComponent";
import LinearProgress from "@material-ui/core/LinearProgress";

const KmpContainer = React.forwardRef<SubmitableForm, {}>((props, ref) => {
  const { id } = useAppSelector((state) => state.leadStore);
  const kmpListInput: RequestWithParentId<
    SearchRequest<KeyManagemetPersonnel>
  > = {
    parentId: id || 0,
    requestValue: {},
  };

  const { data, isLoading } = useListKmpsQuery(kmpListInput);
  const [deleteKmpQuery, status] = useDeleteKmpMutation();
  const [currentKmpId, setCurrentKmpId] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    if (data?.content && data?.content.length > 0) {
      setCurrentKmpId(data?.content[data?.content.length - 1].id);
    } else setCurrentKmpId(undefined);
  }, [data]);

  const deleteKmp = (kmpId: number) => {
    const kmpDelteInput: RequestWithParentId<number> = {
      parentId: id || 0,
      requestValue: kmpId,
    };
    deleteKmpQuery(kmpDelteInput).then(() => {
      setCurrentKmpId(undefined);
      if (data?.content && data?.content.length > 0) {
        setCurrentKmpId(data?.content[0].id);
      } else {
        setCurrentKmpId(undefined);
      }
    });
  };

  return !status.isLoading ? (
    <Grid container padding={0} spacing={2}>
      <Grid item padding={0} xs={12}>
        <Typography
          variant="h6"
          gutterBottom
          style={{ marginBottom: "0px", fontWeight: "600" }}
        >
          Key Management Personnel
        </Typography>
        <Grid item xs={12} lg={12} sx={{ mt: "4px" }}>
          {" "}
          {isLoading ? (
            <CircularProgress />
          ) : data ? (
            [...(data?.content || [])].reverse().map((item) =>
              item ? (
                <Chip
            key={item.id}
                  style={{
            backgroundColor: item.id === currentKmpId ? "white" : undefined,
            border: item.id === currentKmpId ? "3px solid green" : undefined,
                    marginRight: "12px",
                  }}
                  label={item.firstName}
            onClick={() => setCurrentKmpId(item.id)}
            onDelete={() => item.id && deleteKmp(item.id)}
                />
              ) : null
            )
          ) : (
            <></>
          )}
          {data && data?.content.length > 0 && (
            <Chip
              style={{
                backgroundColor:
                  undefined === currentKmpId ? "green" : undefined,
                color: undefined === currentKmpId ? "white" : undefined,
                marginRight: "12px",
              }}
              label="+ Add"
              onClick={() => setCurrentKmpId(undefined)}
            />
          )}
          {!(data && data?.content.length > 0) && (
            <Typography
              variant="subtitle2"
              gutterBottom
              style={{ marginBottom: "0px", fontWeight: "400" }}
            >
              You can add multiple Key Management Personnel after saving this
              first entry.
            </Typography>
          )}
        </Grid>
        <Grid item xs={12} lg={12}>
          {currentKmpId && !status.isLoading && (
            <div style={{ marginTop: "16px" }}>
              {isLoading && (
                <Grid container spacing={0} padding={0}>
                  <Grid item xs={12} lg={12}>
                    <LinearProgress color="secondary" />
                  </Grid>
                </Grid>
              )}
              {!isLoading && (
                <KeyManagemetPersonnelComponent
                  ref={ref}
                  kmpId={currentKmpId}
                />
              )}
            </div>
          )}
          {!currentKmpId && (
            <div style={{ marginTop: "16px" }}>
              {isLoading && (
                <Grid container spacing={0} padding={0}>
                  <Grid item xs={12} lg={12}>
                    <LinearProgress color="secondary" />
                  </Grid>
                </Grid>
              )}
              <KeyManagemetPersonnelComponent ref={ref} kmpId={undefined} />
              {isLoading && (
                <Grid container spacing={0} padding={0}>
                  <Grid item xs={12} lg={12}>
                    <LinearProgress color="secondary" />
                  </Grid>
                </Grid>
              )}
            </div>
          )}
        </Grid>
      </Grid>
    </Grid>
  ) : (
    <CircularProgress />
  );
});

export default KmpContainer;

import EntityForm from "../../Components/Framework/EntityForm";
import { useImperativeHandle, useState } from "react";
import LinearProgress from "@material-ui/core/LinearProgress";
import { useAppSelector } from "../../app/hooks";
import {
  useAddKmpMutation,
  useGetKmpQuery,
  useListKmpsQuery,
  useUpdateKmpMutation,
} from "../../slices/keyManagementPersonnelSlice";
import { Typography, Grid } from "@mui/material";
import { ErrorMessage } from "../../Components/Framework/ErrorMessage";
import { TextBoxField } from "../../Components/Framework/TextBoxField";
import { TextBoxFieldUppercase } from "../../Components/Framework/TextBoxFieldUppercase";
// import { MaskedTextBoxField } from "../../Components/Framework/MaskedTextBoxField";
import { TextBoxFieldAadhaarStartAdornment } from "../../Components/Framework/TextBoxFieldAadhaarStartAdornment";
import {
  FormSubmit,
  SubmitableForm,
} from "../../Components/Framework/FormSubmit";
import React from "react";
import {
  defaultKeyManagemetPersonnel,
  keyManagementPersonnelSchema,
  KeyManagemetPersonnel,
} from "../../models/keyManagementPersonnel";
import { DatePickerField } from "../../Components/Framework/DatePickerField";
// import { DropDownField } from "../../Components/Framework/DropDownField";
import Section from "../../Components/Framework/Section";
import {
  useAddKmpDocumentMutation,
  useDeleteKmpDocumentMutation,
  useLazyListKmpDocumentsQuery,
  useListKmpDocumentsQuery,
} from "../../slices/kmpDocumentSlice";
import { AutocompleteField } from "../../Components/Framework/AutocompleteField";
import {
  useAddKmpBankDetailMutation,
  useDeleteKmpBankDetailMutation,
  useGetKmpBankDetailQuery,
  useListKmpBankDetailsQuery,
  useUpdateKmpBankDetailMutation,
} from "../../slices/kmpBankDetailsSlice";
import {
  useAddKmpBankStatementMutation,
  useDeleteKmpBankStatementMutation,
  useLazyListKmpBankdStatementsQuery,
  useListKmpBankdStatementsQuery,
} from "../../slices/kmpBankStatementSlice";
import BankDetailsContainer from "./BankDetailsContainer";
import DocumentUploadContainer from "./DocumentUploadContainer";
import {
  useAddKmpItrMutation,
  useDeleteKmpItrMutation,
  useListKmpItrsQuery,
} from "../../slices/kmpItrSlice";
import {
  useAddKmpBureauMutation,
  useListKmpBureausQuery,
} from "../../slices/kmpBureauSlice";
import {
  useAddKmpAdditionalDocMutation,
  useDeleteKmpAdditionalDocMutation,
  useListKmpAdditionalDocsQuery,
} from "../../slices/kmpAdditionalDocsSlice";
import { DropDownFieldYesNo } from "../../Components/Framework/DropDownFieldYesNo";
import { RequestWithParentId, SearchRequest } from "../../models/baseModels";
import { BankDetails } from "../../models/bankDetails";
import { Document } from "../../models/document";
import { BankStatement } from "../../models/bankStatement";
import { DropDownFieldYes } from "../../Components/Framework/DropDownFieldYes";
import { TextBoxFieldPercentageEndAdornment } from "../../Components/Framework/TextBoxFieldPercentageEndAdornment";
import { DropDownFieldInlineDomain } from "../../Components/Framework/DropDownFieldInlineDomain";
import { TextBoxFieldUppercaseWithValidation } from "../../Components/Framework/TextBoxFieldUppercaseWithValidation";

const KeyManagemetPersonnelComponent = React.forwardRef<
  SubmitableForm,
  { kmpId: number | undefined }
>((props, ref) => {
  const { id: leadId } = useAppSelector((state) => state.leadStore);

  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const formToSubmit = React.useRef<SubmitableForm>(null);

  const docListInput: RequestWithParentId<SearchRequest<Document>> = {
    parentId: Number(props.kmpId) || 0,
    requestValue: {},
  };

  const bankDetailListInput: RequestWithParentId<SearchRequest<BankDetails>> = {
    parentId: Number(props.kmpId) || 0,
    requestValue: {},
  };

  // const { data: kmpKycDocuments } = useListKmpDocumentsQuery(docListInput);

  const [listKmpDocsQuery] = useLazyListKmpDocumentsQuery();

  const kmpListInput: RequestWithParentId<
    SearchRequest<KeyManagemetPersonnel>
  > = {
    parentId: leadId || 0,
    requestValue: {},
  };

  const { data: kmpList } = useListKmpsQuery(kmpListInput);

  const [validationMessage, setValidationMessage] = useState("");

  const validateAllKmps = async () : Promise<boolean> => {

    let overallValidationResult = true;

    if(kmpList && kmpList.content != undefined && kmpList.content.length > 0) {
      // overallValidationResult = await kmpList.content.forEach(async (item) => {
      //   let result = await validateKmp(item.id);
      //   console.log("validateAllKmps", item.id, result);
      //   overallValidationResult = overallValidationResult && result;
      //   return overallValidationResult;
      // })

      setValidationMessage("");

      for(let i = 0; i <kmpList.content.length; i++) {
        overallValidationResult = await validateKmp(kmpList.content[i].id);
        console.log("validateKmp: return value", kmpList.content[i].id, overallValidationResult);
        if(!overallValidationResult) break;
      }
    } 

    console.log("overallValidationResult", overallValidationResult);

    return overallValidationResult;
  }

  const validateKmp = async (kmpId?: number) : Promise<boolean> => {

    if(kmpId === undefined || Number.isNaN(kmpId)) return true;

    let kmpKycDocuments = await listKmpDocsQuery({
      parentId: Number(kmpId) || 0,
      requestValue: {},
    }).unwrap();

    console.log("KMP Validate Form: ", kmpId, kmpKycDocuments);

    if(kmpKycDocuments?.content === undefined || 
      kmpKycDocuments?.content.length < 2) {
      setValidationMessage("Individual should have atleast 2 KYC Documents");
      console.log("Returing false from validateKmp", kmpId);
      return false;
    }

    if(kmpKycDocuments && kmpKycDocuments.content !== undefined &&
      kmpKycDocuments.content.length > 0) {
        console.log(kmpKycDocuments.content.length);
      //10 represents PAN document. 13 represents Form 60
      //If the DB ID changes, this has to be changed.
      let panDocList = kmpKycDocuments?.content.filter(item => item.type === "10");
      let form60 = kmpKycDocuments?.content.filter(item => item.type === "21");
      if(panDocList.length <= 0 && form60.length <= 0) {
        setValidationMessage("Please upload PAN copy or Form 60 in KYC Documents section.");
        console.log("Returing false from validateKmp", kmpId);
        return false;
      }

      //Requirement: If a KMP has Form 60, then atleast one of voter id / passport / aadhar / driving license / job card should be uploaded
      //4 - Voter ID, 1 - Passport, 2 - DL, 5 - Job Card, ?? - Aadhar
      let voterId = kmpKycDocuments?.content.filter(item => item.type === "4");
      let passport = kmpKycDocuments?.content.filter(item => item.type === "1");
      let driversLicense = kmpKycDocuments?.content.filter(item => item.type === "2");
      let jobCard = kmpKycDocuments?.content.filter(item => item.type === "5");

      if(form60.length > 0) {
        if(voterId.length <= 0 && passport.length <= 0 && driversLicense.length <= 0 && jobCard.length <= 0) {
          setValidationMessage("If FORM 60 is uploaded, then atleast one of voter id / passport / aadhar / driving license / job card should be uploaded.");
          console.log("Returing false from validateKmp", kmpId);
          return false;
        }
      }

      //Requirement: Photo upload is mandatory
      //8 - Photo
      let photo = kmpKycDocuments?.content.filter(item => item.type === "8");
      if(photo.length <= 0) {
        setValidationMessage("Photo is mandatory for individuals.");
        console.log("Returing false from validateKmp", kmpId);
        return false;
      }
    }

    //Requirement: Atleast one of the KMP should have PAN
    if(kmpList && kmpList.content != undefined && kmpList.content.length > 0) {
      let kmpWithPan = kmpList?.content.filter(item => item.pan !== undefined && item.pan !== null);
      if(kmpWithPan.length <= 0) {
        setValidationMessage("Atleast PAN for one individual is mandatory.");
        console.log("Returing false from validateKmp", kmpId);
        return false;
      }
    }

    console.log("Returing true from validateKmp", kmpId);

    return true;
  }

  const validateForm = async () => {
    return validateKmp(props.kmpId);
  };

  useImperativeHandle(ref, () => ({       

		//1. Submit function
		async submit() {
			if(await validateForm()) {
        
        if(formToSubmit.current) 
        {
          let isValidToSubmit = await formToSubmit.current.isValid();

          if(isValidToSubmit) {
            await formToSubmit.current.submit();
            let response = await validateAllKmps();
            console.log("validateAllKmps: ", response);
            return response;
          } else {
            return false;
          }
        }
      } 

      return false;
		},
  
		//2. Check is dirty
		isDirty() {
      if(formToSubmit.current) 
      {
        return formToSubmit.current.isDirty();
      }

      return false;
    },
  
		//3. isValid
		async isValid() {

      setValidationMessage("")

      if(props.kmpId === undefined || Number.isNaN(props.kmpId)) {
        setValidationMessage("Please save and add the mandatory documents before proceeding.");
        return false;
      }

      let formIsValid = await validateAllKmps();

      if(formIsValid && formToSubmit.current)
      {
        let response = await formToSubmit.current.isValid();
        if(response === true) return response;
      }
      return false;
    },
  
		//4. GetValues
		getValues() {

      if(formToSubmit.current && formToSubmit.current.getValues) 
      {
        formToSubmit.current.getValues();
      }

		  return {};
		}
  
		//Add other functions below
		//....
  
  }));

  return leadId ? (
    <EntityForm
      parentId={leadId}
      id={props.kmpId}
      defaultItem={defaultKeyManagemetPersonnel}
      itemSchema={keyManagementPersonnelSchema}
      useAddItemMutation={useAddKmpMutation}
      useUpdateItemMutation={useUpdateKmpMutation}
      useGetItemQuery={useGetKmpQuery}
      setError={setError}
      setIsLoading={setIsLoading}
    >
      <>
        <div>
          <div>
            <Section>
              {validationMessage !== "" && 
              <Grid container spacing={0} paddingTop={2} paddingLeft={4}>
                <Grid item xs={12} lg={12}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    style={{ marginBottom: "0px", fontWeight: "600", color: "red" }}
                  >
                    Check all KMPs for the following error.
                  </Typography>
                </Grid>
                <Grid item xs={12} lg={12}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    style={{ marginBottom: "0px", fontWeight: "600", color: "red" }}
                  >
                    {validationMessage}
                  </Typography>
                </Grid>
              </Grid>}
              <Grid
                container
                style={{ backgroundColor: error && "#FFD1DC" }}
                padding={4}
                paddingTop={2}
                spacing={0}
              >
                <Grid item xs={12} lg={12}>
                  {isLoading && <LinearProgress color="secondary" />}
                </Grid>

                <Grid container spacing={2}>
                  <Grid item xs={12} lg={12}>
                    <ErrorMessage status={error} />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          First Name
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="firstName"
                      multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label="Middle Name "
                      name="middleName"
                      multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          Last Name
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="lastName"
                      multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <DatePickerField
                      label={
                        <>
                          DOB
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="dob"
                      allowPast={true}
                      // ageRestrict={18}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxFieldUppercaseWithValidation
                      label="PAN "
                      name="pan"
                      uppercase={true}
                      maxLength={10}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxFieldAadhaarStartAdornment
                      label={
                        <>
                          Aadhaar Number
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name={"aadhaarNumber"}
                    />
                    {/* <MaskedTextBoxField
                      label="Aadhaar Number"
                      name="aadhaarNumber"
                      mask={[
                        /[X\d]/,
                        /[X\d]/,
                        /[X\d]/,
                        /[X\d]/,
                        "-",
                        /[X\d]/,
                        /[X\d]/,
                        /[X\d]/,
                        /[X\d]/,
                        "-",
                        /\d/,
                        /\d/,
                        /\d/,
                        /\d/,
                      ]}
                      maskNumberValues="XXXX-XXXX-"
                      preOrPostPosition="pre"
                    /> */}
                  </Grid>
                  {/* <Grid item xs={12} lg={4}>
                    <DropDownField
                      label="Gender"
                      name="gender"
                      domain="gender"
                    />
                  </Grid> */}
                  <Grid item xs={12} lg={4}>
                    <AutocompleteField
                      label={
                        <>
                          Beneficiary Category
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="beneficiaryCategory"
                      domain="m_beneficiary_category"
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <AutocompleteField
                      label={
                        <>
                          Marital Status
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="maritalStatus"
                      domain="m_marital_status"
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxFieldUppercase
                      label={
                        <>
                          CKYC Number
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="ckycNumber"
                      maxLength={14}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <DropDownFieldYesNo
                      label={
                        <>
                          Politically Exposed Person
                          <span className="required_symbol"
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="politicallyExposedPerson"
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <DropDownFieldYes
                      label={
                        <>
                          UN Terrorist Checked & No Matches Found
                          <span className="required_symbol"
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="unTerroist"
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2} paddingY={4}>
                  <Grid item xs={12}>
                    <hr
                      style={{
                        marginTop: 0,
                        marginBottom: "8px",
                        backgroundColor: "#C0C0C0",
                        color: "#C0C0C0",
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} lg={12}>
                    <Typography
                      variant="h6"
                      gutterBottom
                      style={{ marginBottom: "0px", fontWeight: "600" }}
                    >
                      Contact Information
                    </Typography>
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          Email
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="contactInformation.email"
                      multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          Phone Number
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="contactInformation.phoneNumber"
                      type="number"
                      maxLength={10}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          Address
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="contactInformation.address"
                      multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    {/* <AutocompleteField
                      label="City "
                      name="contactInformation.city"
                      domain="cities"
                      filter="contactInformation.state"
                    /> */}
                    <TextBoxField
                      label={
                        <>
                          City
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="contactInformation.city"
                      multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <AutocompleteField
                      label={
                        <>
                          State
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="contactInformation.state"
                      domain="m_states"
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          Pin Code
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="contactInformation.pincode"
                      type="number"
                      maxLength={6}
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <hr
                      style={{
                        marginTop: 0,
                        marginBottom: "8px",
                        backgroundColor: "#C0C0C0",
                        color: "#C0C0C0",
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} lg={12}>
                    <Typography
                      variant="h6"
                      gutterBottom
                      style={{ marginBottom: "0px", fontWeight: "600" }}
                    >
                      Professional Information
                    </Typography>
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <DatePickerField
                      label={
                        <>
                          Appointment Date
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="professionalInformation.appointmentDate"
                      allowPast={true}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    {/* <DropDownField
                      label="Designation"
                      name="professionalInformation.designation"
                      domain="designation"
                    /> */}
                    <DropDownFieldInlineDomain
                      label={
                        <>
                          KMP Type
                          <span className="required_symbol"
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="professionalInformation.designation"
                      domain={["Financial", "Non financial"]}
                      // multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          Experience in Years
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="professionalInformation.experienceInYear"
                      type="number"
                      maxLength={2}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <AutocompleteField
                      label={
                        <>
                          Beneficiary Type
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="professionalInformation.beneficiaryType"
                      domain="m_beneficiary_type"
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxFieldPercentageEndAdornment
                      label={
                        <>
                          Shareholding
                          <span
                            style={{ color: "red" }}
                          >
                            {" "}
                            *
                          </span>
                        </>
                      }
                      name="professionalInformation.shareHolding"
                    />
                  </Grid>
                  <Grid item xs={12} lg={12}>
                    {!props.kmpId && (
                      <span>
                        Please save the Key Management Personnel to add related
                        documents & bank details.
                      </span>
                    )}
                  </Grid>
                </Grid>
              </Grid>
            </Section>
          </div>
        </div>

        {props.kmpId && (
          <>
            <DocumentUploadContainer
              parentId={props.kmpId}
              message="Save the Key management personal to add documents."
              heading="KYC Documents"
              bucket="kmpDocuments"
              documentTypeDomain={"m_kmp_kyc_document_type"}
              useAddMutation={useAddKmpDocumentMutation}
              useListQuery={useListKmpDocumentsQuery}
              useDeleteMutation={useDeleteKmpDocumentMutation}
              // type="pdf, image"
            />

            <BankDetailsContainer
              parentId={props.kmpId}
              bucket="kmp"
              ref={ref}
              message="Save the Key management personal to add bank details."
              useAddBankDetailMutation={useAddKmpBankDetailMutation}
              useGetBankDetailQuery={useGetKmpBankDetailQuery}
              useUpdateBankDetailMutation={useUpdateKmpBankDetailMutation}
              useDeleteBankDetailMutation={useDeleteKmpBankDetailMutation}
              useListBankDetailsQuery={useListKmpBankDetailsQuery}
              useAddBankStatementMutation={useAddKmpBankStatementMutation}
              useListBankStatementsQuery={useListKmpBankdStatementsQuery}
              useDeleteBankStatementMutation={useDeleteKmpBankStatementMutation}
            />

            <DocumentUploadContainer
              parentId={props.kmpId}
              heading={"ITR Documents"}
              message="Save the Key management personal to add documents."
              bucket={"kmpItrDocuments"}
              documentTypeDomain={"lastThreeFinancialYears"}
              useAddMutation={useAddKmpItrMutation}
              useListQuery={useListKmpItrsQuery}
              useDeleteMutation={useDeleteKmpItrMutation}
            />
            <DocumentUploadContainer
              parentId={props.kmpId}
              heading={"Bureau"}
              message="Save the Key management personal to add documents."
              bucket={"kmpBureaus"}
              documentTypeDomain={"m_bureau"}
              useAddMutation={useAddKmpBureauMutation}
              useListQuery={useListKmpBureausQuery}
              useDeleteMutation={useDeleteKmpBankDetailMutation}
            />
            <DocumentUploadContainer
              parentId={props.kmpId}
              heading={"Additional Documents"}
              message="Save the Key management personal to add documents."
              bucket={"kmpAdditionalDocuments"}
              documentTypeDomain={"m_kmp_kyc_document_type"}
              useAddMutation={useAddKmpAdditionalDocMutation}
              useListQuery={useListKmpAdditionalDocsQuery}
              useDeleteMutation={useDeleteKmpAdditionalDocMutation}
            />
          </>
        )}
      </>
      <FormSubmit ref={formToSubmit} />
    </EntityForm>
  ) : (
    <>Loading...</>
  );
});

export default KeyManagemetPersonnelComponent;


import { Grid } from "@mui/material";
import { PropsWithChildren, useCallback, useEffect } from "react";
import { Formik } from "formik";
import { skipToken } from "@reduxjs/toolkit/dist/query";
import React from "react";
import * as Yup from "yup";
// import { CircularProgress } from "@material-ui/core";
import { RequestWithParentId } from "../../models/baseModels";
import LinearProgress from "@mui/material/LinearProgress";
import Box from "@mui/material/Box";

const EntityForm = <T,>(
  props: PropsWithChildren<{
    id?: number;
    parentId?: number;
    defaultItem: T;
    useAddItemMutation?: any;
    useUpdateItemMutation?: any;
    useGetItemQuery?: any;
    itemSchema: Yup.ObjectSchema<{}, Yup.AnyObject, {}, "">;
    setError?: (error: string) => void;
    setIsLoading?: (loading: boolean) => void;
    setItemId?: (id: number) => void;
  }>
) => {
  // const [itemId, setItemInternalId] = useState<number>(Number(props.id));

  const { id: itemId } = props;
  const { parentId } = props;

  const setError = useCallback(
    (error: string) => props.setError && props.setError(error),
    [props]
  );
  const setIsLoading = useCallback(
    (loading: boolean) => props.setIsLoading && props.setIsLoading(loading),
    [props]
  );

  const [addItem, statusAdd] = (props.useAddItemMutation &&
    props.useAddItemMutation()) || [null, { isError: false, isLoading: false }];
  const [updateItem, statusUpdate] = (props.useUpdateItemMutation &&
    props.useUpdateItemMutation()) || [
      null,
      { isError: false, isLoading: false },
    ];

  const getRequestPayload = useCallback((
    payload: any,
    parentId: number | undefined
  ): number | RequestWithParentId<number> | typeof skipToken => {
    if (payload === undefined || Number.isNaN(payload)) return skipToken;
    if (parentId !== undefined) {
      return {
        parentId,
        requestValue: payload,
      };
    } else {
      return payload;
    }
  }, []);

  const {
    data: item,
    isLoading,
    error: getQueryError,
  } = (props.useGetItemQuery &&
    props.useGetItemQuery(getRequestPayload(itemId, parentId))) || [
      null,
      { isLoading: false, error: null },
    ];

  useEffect(() => {
    if (statusAdd.isError) {
      setError && setError(statusAdd.error.error);
    }
  }, [statusAdd, setError]);

  useEffect(() => {
    if (statusUpdate.isError) setError && setError(statusUpdate.error.error);
  }, [statusUpdate, setError]);

  useEffect(() => {
    if (getQueryError) setError && setError(getQueryError);
  }, [getQueryError, setError]);

  useEffect(() => {
    setIsLoading &&
      setIsLoading(statusAdd.isLoading || statusUpdate.isLoading || isLoading);
  }, [statusAdd.isLoading, statusUpdate.isLoading, isLoading, setIsLoading]);

  const [progress, setProgress] = React.useState(0);
  const progressRef = React.useRef(() => { });
  React.useEffect(() => {
    progressRef.current = () => {
      if (progress > 100) {
        setProgress(0);
      } else {
        const diff = Math.random() * 10;
        setProgress(progress + diff);
      }
    };
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      progressRef.current();
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return !isLoading ? (
    <Formik
      initialValues={
        itemId ? { ...props.defaultItem, ...item } : { ...props.defaultItem }
      }
      enableReinitialize={true}
      validationSchema={props.itemSchema}
      onSubmit={async (values, bag) => {
        props.setError && props.setError("");
        const errors = await bag.validateForm(); //Validate to get the errors
        console.log("inside form submit on submit", errors);
        if(Object.keys(errors).length === 0) {
          if (!item?.id) {
            console.log("Submitting....", addItem)
            if (addItem) {
              await addItem(getRequestPayload(values, parentId))
                .unwrap()
                .then((data: { id: React.SetStateAction<number> }) => {
                  data.id && props.setItemId && props.setItemId(Number(data.id));
                })
                .catch((error: any) => {
                  console.error("addItem Error", error);
                  props.setError && props.setError(error);
                });
            } else {
              console.error("addItem is null.")
            }
          } else {
            await updateItem(getRequestPayload({ ...item, ...values }, parentId));
          }
        } else {
          console.log("Form has errors");
        }
        
      }}
    >
      <>{props.children}</>
    </Formik>
  ) : (
    // <CircularProgress size={50} />
    // <Grid container spacing={2} padding={4} justifyContent={"center"}>
    //   <Box sx={{ width: "100%", backgroundColor: "#FFFFFF", padding: 4 }}>
    //     <LinearProgress />
    //   </Box>
    // </Grid>
    <></>
  );
};

export default EntityForm;


import { setIn, useFormikContext } from "formik";
import { useImperativeHandle } from "react";
import { KeyValuePair } from "./KeyValuePair";
import React from "react";

//All forms using FormSubmit should forward ref of this interface type
export type SubmitableForm = {
  submit: () => Promise<boolean>;
  isDirty: () => boolean;
  isValid: (finalSubmit?: boolean) => Promise<boolean>;
  getValues?: () => KeyValuePair;
};

export const FormSubmit = React.forwardRef<SubmitableForm, {}>((props, ref) => {

  //Get the formik that is enclosing the Form Submit Component
  const { values, submitForm, validateForm, dirty, touched } =
    useFormikContext<KeyValuePair>() || {};

  //Instance functions Block
  useImperativeHandle(ref, () => ({       

    //1. Submit function
    async submit() {
      console.log("values", values);
      const errors = await validateForm(); //Validate to get the errors
      console.log("FormSubmit", dirty, errors, values)
      if (dirty || Object.keys(errors).length > 0) {
        //Try submitting the formik form to show the errors in the UI if any
        await submitForm()
        return Object.keys(errors).length === 0; //Return the status of form submission
      }
      else return true; //Return sucess if the form is not dirty.
    },

    //2. Check is dirty
    isDirty() {return dirty},

    //3. isValid
    async isValid() {
      const errors = await validateForm(); //Validate to get the errors
      console.log("isValid, dirty", errors, Object.keys(errors).length, dirty);
      if (Object.keys(errors).length > 0) {
        //Try submitting the formik form to show the errors in the UI if any
        await submitForm()
        Object.keys(errors).map(key => {
          console.log("key", key)
          setIn(touched, key, true);
        })
        return Object.keys(errors).length === 0; //Return the status of form submission
      } else {
        return true;
      }
    },

    //4. GetValues
    getValues() {
      return values;
    }

    //Add other functions below
    //....

  }));
  return ref ? <></> : <span color="red">Invalid Formsbmit inside non form element!</span>;
});


so in this i want to add one new api that is before submit 
