import React, { useEffect, useState } from 'react';
import {
  Grid,
  Divider,
  Button,
  Tooltip,
  Tabs,
  Tab,
  Box,
  Fade
} from '@mui/material';
import { Formik, Form, FormikProps } from 'formik';
import ErrorMessageGlobal from '../../../components/framework/ErrorMessageGlobal';
import { TextBoxField } from '../../../components/framework/TextBoxField';
import { PnfTextBoxField } from "../components/PnfTextBoxField"
import { defaultPnfInformation, pnfInformationSchema } from '../../../models/pnf/pnf';
import {
  useAddPnfMutation, useGetPnfQuery,
  useGetPnfEmailStatusQuery,
  useLazyPnfReportQuery,
  useLazyGetPnfQuery
} from '../../../features/pnf/api';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { setDrawerState, setPnfStatus } from '../../../features/lead/leadSlice';
import { Link, useLocation, } from 'react-router-dom';
import { AiOutlineArrowLeft, AiOutlineFilePdf } from "react-icons/ai";
import { MultipleDropDownField } from '../components/MultiplePnfDropDown';
import Section from '../../nbfc/Section';
import Workflow from '../../workflow/Workflow';
import { TabPanelProps } from "../../../models/tabPanel";
import SaveAsIcon from '@mui/icons-material/SaveAs';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { UploadAPI } from '../../../features/upload/upload';
import Alert from '@mui/material/Alert';
import BrowserUpdatedIcon from '@mui/icons-material/BrowserUpdated';
import Snackbar, { SnackbarCloseReason } from '@mui/material/Snackbar';
import MultiFileUpload from '../../marketIntelligenceSheet/components/MultipleFileUpload';
import { useGetOldWorkflowDetailsQuery, useLazyGetWorkflowDetailsQuery } from '../../../features/workflow/api';
import NbfcSnackbar from '../../../components/shared/NbfcSnackbar';
import { OldWorkFlowMain } from '../../workflow/OldWorkFlowMain';
import { PANInputField } from '../../../components/framework/PANInputField';
import AutoSave from '../../../components/framework/AutoSave';
import { useNavigate } from "react-router-dom";
import { TextAreaField } from '../../../components/framework/TextAreaAuto';
import Cookies from 'js-cookie';
import { setPNFIdData } from '../../../features/user/userSlice';
import FullScreenLoaderNoClose from '../../../components/common/FullScreenLoaderNoClose';
import zIndex from '@mui/material/styles/zIndex';


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
  let location = useLocation();
  const [value, setValue] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleCloseWorkFlow = () => {
    setOpenSnackbar(false);
  };
  // const [pnfId, updatePnfId] = useState<number | null | any>();
  sessionStorage.setItem("pnfId", pnfId);

  const [error, setError] = useState<any>();
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useAppDispatch();
  const [addPnf] = useAddPnfMutation();
  const [showViewModal, setShowViewModal] = useState(false);
  const [fileTypePdf, setFileTypePdf] = useState(false);
  const [newFiles, setNewFiles] = useState<any>([]);
  const [isNew, setIsNew] = useState<boolean>(true);
  const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<any>("");
  const [severity, setSeverity] = useState<string | any>("success");
  const [reportDataModal, setReportDataModal] = useState<any>();
  const [isManualSave, setIsManualSave] = useState(false);

  const { data: initialData, isLoading: isInitialLoading, refetch: refetchPnfData } = useGetPnfQuery(pnfId, { skip: !pnfId, refetchOnMountOrArgChange: true });
  const { userData } = useAppSelector((state: any) => state.userStore);
  const { data: oldWorkflowDetails } = useGetOldWorkflowDetailsQuery({ formId: pnfId, formType: "PNF" }, {
    skip: !pnfId,
    refetchOnMountOrArgChange: true
  });

  const [getPnfData] = useLazyGetPnfQuery();

  useEffect(() => {
    if (location.pathname.split("/")[2] === 'pnf') {
      dispatch(setDrawerState(false));
    }
    if (location?.state?.id) {
      console.log('location?.state', location?.state);
      // updatePnfId(location?.state?.id);
      dispatch(setPNFIdData(location?.state?.id));

    }
  }, [location]);



  interface IFormValues {
    myInput: string;
  }

  const [checkWorkFlow] = useLazyGetWorkflowDetailsQuery();
  const [generateReport] = useLazyPnfReportQuery()

  const handleButtonClick = async (
    status: "01" | "02" | "03" | "04",
    formikProps: FormikProps<IFormValues>
  ) => {
    const { values, submitForm, setSubmitting, validateForm, } = formikProps;
    setIsLoading(true);
    setError(null);
    submitForm();
    const error = await validateForm();
    console.log("error",error);
    if (Object.keys(error).length === 0) {
      try {
        setIsManualSave(true);

        if (status == "02") {
          const workflowDetails = await checkWorkFlow({ formId: pnfId, formType: "PNF" }).unwrap();
          if (workflowDetails && workflowDetails.length < 2) {
            setSubmitting(false);
            setIsLoading(false);
            setOpenSnackbar(true);
            setSeverity("error");
            setSnackMsg("Please assign workflow before proceeding. ");
            return false;
          }
        }
        let responseId;
        if (pnfId) {
          const response: any = await addPnf({ ...values, pnfId: pnfId, status, makerId: userData?.userId, pnfDoc: newFiles }).unwrap();
          responseId = response?.pnfId;
        } else {
          const response = await addPnf({ ...values, status, makerId: userData?.userId, pnfDoc: newFiles }).unwrap();
          responseId = response?.pnfId;
          // updatePnfId(response.pnfId);
          dispatch(setPNFIdData(response.pnfId));
        }

        if (responseId) {
          for (const file of newFiles) {
            const pnfDocData = {
              pnfId: responseId,
              slNo: file.slNo
            };
            await UploadAPI.updateDoc(pnfDocData, "/pnf/updatePnfDoc");
            await getPnfData(responseId).unwrap();
          }
          setIsNew(false);
        }
        setSubmitting(false);
        dispatch(setPnfStatus(status));
        if (status == "01") {
          setOpen(true);

        }

        if (status == "02") {
          setOpenSnackbar(true);
          setSeverity("success");
          setSnackMsg("PNF Submit Successfully!");
          for (const file of newFiles) {
            const pnfDocData = {
              pnfId: responseId,
              slNo: file.slNo
            };
            await UploadAPI.updateDoc(pnfDocData, "/pnf/updatePnfDoc");
            await getPnfData(responseId).unwrap();
          }
        }

      } catch (error) {
        setSubmitting(false);
        setIsLoading(false);
        setIsManualSave(false);
        setError(error);

      } finally {
        setIsLoading(false);
        setIsManualSave(false);
      }
    }
    else {
      setSubmitting(false);
      setIsLoading(false);
      setIsManualSave(false);
    }
  };

  const handleAutoSave = async (values: any) => {
    setIsLoading(true);
    setError(null);
    try {
      let responseId;
      const { customerName }: any = values;
      const customerSplit: any = customerName.split("-")?.map((customer: any) => {
        if (customer === "null") return undefined;
        return customer
      });

      if (pnfId) {
        const response: any = await addPnf({
          ...values,
          id: pnfId,
          status: "01",
          makerId: userData?.userId,
          pnfDoc: newFiles
        }).unwrap();
        responseId = response?.pnfId;
      } else {
        const response = await addPnf({
          ...values,
          status: "01",
          makerId: userData?.userId,
          pnfDoc: newFiles
        }).unwrap();
        responseId = response?.pnfId;
        //updatePnfId(response.pnfId);
        dispatch(setPNFIdData(response.pnfId));
      }

      if (responseId) {
        for (const file of newFiles) {
          const pnfDocData = {
            pnfId: responseId,
            slNo: file.slNo
          };
          await UploadAPI.updateDoc(pnfDocData, "/pnf/updatePnfDoc");
        }
        setIsNew(false);
      }
      return true;
    } catch (error) {
      console.error('Error in autosave:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const { data: emailValue } = useGetPnfEmailStatusQuery(
    {
      id: initialData?.nominationEmailId,
      pnfId: pnfId,
    },
    { skip: !initialData?.nominationEmailId });

  const handleClose = (
    event?: React.SyntheticEvent | Event,
    reason?: SnackbarCloseReason,
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };


  function showFileFromByteArray(byteArray: any, mimeType: any) {
    const byteCharacters = atob(byteArray);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray1 = new Uint8Array(byteNumbers);
    const file = new Blob([byteArray1], { type: 'application/pdf;base64' });
    const fileURL = URL.createObjectURL(file);
    window.open(fileURL);
  }

  const handleViewModal = async (event: any) => {
    try {
      const reportData: any = await generateReport(pnfId).unwrap();
      showFileFromByteArray(reportData?.repData, reportData?.mimeType)
      setReportDataModal(reportData?.repData);
      setShowViewModal(true);
      setFileTypePdf(true);
    } catch (error) {
    }

  }

  useEffect(() => {
    if (value === 0 && pnfId) {
      refetchPnfData();
    }
  }, [value, pnfId, refetchPnfData]);


  const [id, setId] = useState<any>("");
  const [show, setShow] = useState(true);
  const loginData: any = Cookies.get("user") ?? null;
  const loginCookiesData: any = JSON.parse(loginData);

  const handleShow = () => {
    setShow((preValue: boolean) => !preValue)
  }

  let navigate = useNavigate();

  const handleNavigate = () => {
    navigate("/los/pnf-dashboard")
  }
  if (isManualSave) return <FullScreenLoaderNoClose />;


  return (
    <Grid
      container
      className="los_mainwra">
      <Grid item xs={12} className="los_rgtdata">
        <div className="wrap-appraisal-area">
          <Section>
            <Box className="wrap-tabs" sx={{ width: '100%' }}>
              <Box className="tab-with-btn ps-0" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <span className='back' style={{ top: '0px' }}>
                  <Tooltip arrow
                    TransitionComponent={Fade}
                    TransitionProps={{ timeout: 600 }}
                    title="Back PNF Dashboard" placement="top">
                    {/* <Link to="/los/pnf-dashboard" className="in-clickable font17 round-button">
                    <AiOutlineArrowLeft className="me-2" /> Back
                    </Link> */}

                    <Button variant="outlined" color='inherit'
                      size="small" onClick={handleNavigate}>
                      <AiOutlineArrowLeft className="me-0" /> Back
                    </Button>
                  </Tooltip>
                </span>
                <Tabs className="tabs-header" value={value} onChange={handleChange} aria-label="basic tabs example">
                  <Tab className="tab-ui" label="Pnf Form" {...a11yProps(0)} />
                  <Tab className="tab-ui" label="Workflow" {...a11yProps(1)} />
                  {oldWorkflowDetails && oldWorkflowDetails.length > 0 && <Tab className="tab-ui" label="WorkFlowHistory" {...a11yProps(2)} />}
                </Tabs>
              </Box>
              <CustomTabPanel value={value} index={0}>
                <ErrorMessageGlobal status={error} />
                <Section>
                  <div className='custome-form'>
                    <div className='d-flex justify-content-end'>
                      {
                        !pnfId && (
                          <Button
                            variant="contained"
                            size="small"
                            className="text-capitalize shadow-none search-color vRprt"
                            startIcon={<AiOutlineFilePdf />}
                          >&nbsp;Please fill details to View Report
                          </Button>
                        )
                      }

                      {pnfId &&
                        <Button
                          variant="contained"
                          size="small"
                          className="text-capitalize shadow-none search-color"
                          onClick={(event) => handleViewModal(event)}
                          startIcon={<AiOutlineFilePdf />}
                          sx={{ zIndex: 10, position: 'relative' }}
                        >
                          View Report
                        </Button>
                      }
                    </div>
                    <Formik
                      initialValues={initialData || defaultPnfInformation}
                      validationSchema={pnfInformationSchema}
                      onSubmit={() => console.log("")}
                      enableReinitialize={true}
                    >
                      {formikProps => {
                        const {
                          values,
                          isSubmitting,
                        } = formikProps;

                        return (
                          <Form>
                            {((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker") && (
                              <AutoSave
                                debounceMs={5000}
                                handleSubmit={handleAutoSave}
                                values={values}
                              />
                            )}
                            <Grid spacing={2} padding={4} container className='form-grid pt-0 pb-0'>
                              <Grid item xs={12} lg={12}>
                                <div className='mirDtls'>
                                  <Grid spacing={2} padding={4} container className='form-grid pt-0 pb-0'>
                                    <Grid item xs={12} lg={12}>
                                      <Divider className='mt-0 mb-0' textAlign="left">
                                        <span className='seperator-ui'>MIR Details</span>
                                      </Divider>
                                    </Grid>


                                    <Grid item xs={12} sm={6} md={3} lg={4}>
                                      <MultipleDropDownField
                                        label="Select MIR: *"
                                        name="mirId"
                                        domain="mir/getMirPnfList"
                                        disabled={!((values.status === "01" || values.status === "05")
                                          && loginCookiesData?.regType === "Maker")}
                                      />
                                    </Grid>

                                    <Grid item xs={12} sm={6} md={3} lg={4}>
                                      <TextBoxField label="Name of Borrower: *" name="customerName"
                                        disabled={!((values.status === "01" || values.status === "05")
                                          && loginCookiesData?.regType === "Maker")} />

                                    </Grid>

                                    <Grid item xs={12} sm={6} md={3} lg={4}>
                                      <PANInputField
                                        label="Pan" name="pan"
                                        isRequired={true}
                                        disabled={!((values.status === "01" || values.status === "05")
                                          && loginCookiesData?.regType === "Maker")} />
                                    </Grid>

                                    <Grid item xs={12} sm={6} md={12} lg={12} className='text_count'>
                                      <TextAreaField restrictedCharacters="¿"
                                        label="Nature of Business: *" name="businessNature"
                                        disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} maxLength={500} />
                                      {/* <TextBoxField label="Nature of Business: * "
                                        name="businessNature"
                                        disabled={userData?.regType != "Maker"}
                                      /> */}
                                    </Grid>
                                  </Grid>
                                </div>
                              </Grid>


                              <Grid item xs={12} lg={12}>
                                <Divider className='mt-3 mb-0' textAlign="left">
                                  <span className='seperator-ui'>Details of Nominated Personnel </span>
                                </Divider>
                              </Grid>
                              <Grid item xs={12} lg={12}>
                                <Alert severity="warning" className='cstmSz'>
                                  <strong> Note:</strong> User ID will be generated from the <strong>Official Email Id field.</strong> Kindly verify it..
                                </Alert>
                              </Grid>
                              <Grid item xs={12} lg={3}>
                                <TextBoxField label="Name *" name="nominationName"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={3}>
                                <TextBoxField name="nominationType" label="Type of Employee"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={3}>
                                <TextBoxField name="nominationDesgn" label="Designation *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={3}>
                                <TextBoxField name="nominationEmpId" label="Employee Id *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={2}>
                                <PnfTextBoxField name="nominationEmailId" label="Official Email Id *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                                {!emailValue ? <> </> : emailValue && values.status == "01" ?
                                  <span style={{
                                    color: "#d43333",
                                    fontWeight: "10px"
                                  }}>This email address is already in use.
                                  </span> : <></>}
                              </Grid>
                              <Grid item xs={12} lg={2}>
                                <TextBoxField name="nominationMobileNo" label="Mobile No *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={2}>
                                <PANInputField name="nominationPan" label="Pan Number *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField name="nominationAuthBy" label="Authorized By"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={12}>
                                <Divider className='mt-3 mb-0' textAlign="left">
                                  <span className='seperator-ui'>Details of Authorized Signatory (As Per Board Resolution)</span>
                                </Divider>
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField name="authName" label="Name *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField name="authType" label="Type of Employee"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField name="authDesgn" label="Designation *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField name="authEmpId" label="Employee Id *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField name="authBehalf" label="Acting on Behalf of *"
                                  disabled={true} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField name="authEmailId" label="Official Email Id *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <TextBoxField name="authMobileNo" label="Official Mobile No *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>
                              <Grid item xs={12} lg={4}>
                                <PANInputField
                                  isRequired={true}
                                  name="authPan" label="Pan Number *"
                                  disabled={!((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker")} />
                              </Grid>

                              <Grid item xs={6} className='pt-0'>
                                <MultiFileUpload
                                  initialFiles={values.pnfDoc || []}
                                  onFileChange={(files) => setNewFiles(files)}
                                  disabled={!((values.status === "01" || values.status === "05")
                                    && loginCookiesData?.regType === "Maker")}
                                  isNew={isNew}
                                  isFrom='pnf'
                                />
                              </Grid>
                              <Grid item xs={12} textAlign="right" className='p-0 mt-0'>
                                {((values.status === "01" || values.status === "05") && loginCookiesData?.regType === "Maker") ? <><Button
                                  variant="contained"
                                  size="small"
                                  className="text-capitalize sbmtBtn"
                                  onClick={() => handleButtonClick("01", formikProps)}
                                  disabled={isSubmitting}
                                >
                                  {initialData ? <> Save <BrowserUpdatedIcon /></> : <> Save as draft &nbsp;<SaveAsIcon /></>}
                                </Button>


                                  {initialData && (
                                    <>  <Button
                                      variant="contained"
                                      size="small"
                                      className="text-capitalize sbmtBtn sbmtBtn_scn"
                                      onClick={() => handleButtonClick("02", formikProps)}
                                      disabled={emailValue || isSubmitting}
                                    >
                                      Submit <CheckCircleIcon />
                                    </Button></>
                                  )
                                  }</>
                                  : <></>}

                              </Grid>
                            </Grid>
                          </Form>
                        )
                      }}
                    </Formik>
                  </div>
                </Section>
              </CustomTabPanel>
              <CustomTabPanel value={value} index={1}>
                <Workflow formIdVal={pnfId} formTypeVal={'PNF'} />
              </CustomTabPanel>
              <OldWorkFlowMain value={value} oldWorkflowDetails={oldWorkflowDetails} />
            </Box>
          </Section>
        </div>
        <Snackbar open={open} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          autoHideDuration={3000} onClose={handleClose}>
          <Alert
            onClose={handleClose}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            Personal nomination Form Saved Successfully!
          </Alert>
        </Snackbar>
        <NbfcSnackbar open={openSnackbar} msg={snackMsg} severity={severity}
          handleSnackClose={handleCloseWorkFlow} submitCall={false} />
      </Grid>
    </Grid>
  );
}

export default PnfForm;


import React, { useMemo } from "react";
import { KeyValuePair } from "../../../components/framework/KeyValuePair";
import { getIn, useFormikContext } from "formik";
import Typography from "@mui/material/Typography";
import { Autocomplete, TextField, Grid } from "@mui/material";
import { useGetMaterQuery } from "../../../features/master/api";
import { modify } from "../../../utlis/helpers";
import { useGetMirQuery } from "../../../features/mir/api";

export const MultipleDropDownField = (props: {
  label?: string;
  name: string;
  domain: string;
  disabled?: boolean
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
    isLoading: isMasterLoading,
    error: masterError,
  } = useGetMaterQuery(`refapi/${props.domain}`, {
    refetchOnMountOrArgChange: true
  });

  const {
    data: infoData,
    isLoading: infoLoading,
    error: infoError
  } = useGetMirQuery(getIn(values, props.name), {
    skip: !getIn(values, props.name)
  });

  const options = React.useMemo(() => {
    const transformedOptions = modify(props.domain, masterData)?.map((item: any) => ({
      key: item.key,
      value: props.domain !== "mir/getMirPnfList" ? item.value : item.key,
      label: item.label || item.value
    })) || [];

    return transformedOptions;
  }, [masterData, props.domain]);

  React.useEffect(() => {
    if (infoData) {
      setFieldValue("custDetails", infoData?.customerDetails);
      setFieldValue("customerName", infoData?.nbfcName);
      setFieldValue("authBehalf", infoData?.nbfcName);
      setFieldValue("businessNature", infoData?.businessNature);
      setFieldValue("loanPurpose", infoData?.loanPurpose);
      setFieldValue("pan", infoData?.panNo);
      setFieldValue("nbfcId", infoData?.nbfcId);
      setFieldValue("cifCd", infoData?.cifCd);
    }
  }, [infoData, setFieldValue]);

  const currentValue = useMemo(() => {
    return options.find(
      (option: any) => option.value == getIn(values, props.name)
    ) || null;
  }, [options, values, props.name]);

  return (
    <Grid item xs={12}>
      <Autocomplete
      sx={{
        "& .MuiOutlinedInput-root": {
          paddingRight: "20px!important",
          paddingLeft: "0px!important",
        },
      }}
        fullWidth
        options={options}
        value={currentValue}
        disabled={props?.disabled}
        loading={isMasterLoading}
        onChange={(_, newValue) => {
          setFieldValue(props.name, newValue ? newValue.value : null);
        }}
        onBlur={handleBlur}
        getOptionLabel={(option) => option.label}
        renderInput={(params) => (
          <TextField
            {...params}
            name={props.name}
            label={props.label}
            variant="outlined"
          // error={!!getIn(errors, props.name)}
          // helperText={
          //   getIn(touched, props.name) &&
          //   getIn(errors, props.name) &&
          //   JSON.stringify(getIn(errors, props.name)).replaceAll('"', "")
          // }
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

import { createApi } from "@reduxjs/toolkit/query/react";
import { crudApiTemplate, customBaseQuery } from "../../app/commonApi";
import { PagedResult, SearchRequest } from "../../models/baseModels";
import { count } from "console";
import { getStatusCodeValue, statusCode } from "../../utlis/helpers";
import { STATUS, sortedOrders } from "../../utlis/constants";

const entity = "pnf";
const path = `pnfApi`;
const tags = [entity];

export const pnfApi = createApi({
    reducerPath: path,
    baseQuery: customBaseQuery('refapi'),
    tagTypes: tags,
    endpoints: (builder) => ({
        listPnf: builder.query<PagedResult<any>, SearchRequest<any>>({
            query: (searchReqeust) => crudApiTemplate(entity).listItem(searchReqeust),

            providesTags: tags,
        }),
        getAllPnf: builder.query<any, void>({
            query: () => crudApiTemplate(entity).getAllItem(),
            transformResponse: (response: any) => {
                const modifiedData = response && response.map((item: any, key: number) => {
                    return {
                        sNo: +key + 1, ...item
                    }
                });
                return modifiedData;
            },
            providesTags: tags,
        }),
        getPnf: builder.query<any, number>({
            query: (id) => crudApiTemplate('pnf/getPnf').getItem(id),
            providesTags: tags,
        }),

        getPnfData: builder.query<any, any>({
            query: (id) => crudApiTemplate(entity).performCommonActionWithId('getPnfDetByApplId', id, "applId"),
            providesTags: tags,
        }),
        getPnfStatus: builder.query<any, any>({
            query: (body) => crudApiTemplate(entity).getItemByBody('getByPnfStatus', body),
            transformResponse: (response: any) => {
                const modifiedData = response && response.map((item: any, key: number) => {
                    return {
                        ...item,
                        sNo: +key + 1,
                        status: getStatusCodeValue(item?.status)
                    }
                });
                return modifiedData;
            },
            providesTags: tags,
        }),
  
        getPnfStatusCount: builder.query<any, any>({
            query: (body) => crudApiTemplate(entity).getItemByBody('getPnfStatusCount',body),
            transformResponse: (response: any) => {
                const modifiedData = response && response.map((item: any, key: number) => {
                    if (item.STATUS !== "INITIAL") {
                        return {
                            count: item.COUNT,
                            status: item.STATUS === "Total" ? "Total Application" : item.STATUS,
                            statusCode: statusCode(item.STATUS)
                        }
                    }
                }).filter(Boolean);
                return modifiedData.sort(function (a: any, b: any) {
                    return sortedOrders[a.status] - sortedOrders[b.status];
                });
            },
            providesTags: tags,
        }),
        pnfReport: builder.query<any, any>({
            query: (id) => crudApiTemplate(entity).performCommonActionWithId('genReport', id, "pnfId"),
            providesTags: tags,
        }),
        pnfReportData: builder.query<any, any>({
            query: (id) => crudApiTemplate(entity).performCommonActionWithId('genReport', id, "pnfId"),
            providesTags: tags,
        }),
        getPnfEmailStatus: builder.query<any, any>({
            query: (params) => crudApiTemplate(entity).performCommonActionWithRequestParam2('checkMail', "mailId", params.id , "pnfId", params.pnfId),
            // providesTags: tags,
        }),
        addPnf: builder.mutation<any, any>({
            query: (body) => crudApiTemplate('pnf/savePnf').addItem(body),
            invalidatesTags: tags,
        }),
        updatePnf: builder.mutation<any, any>({
            query: (body) => crudApiTemplate(entity).updateItem(body),
            invalidatesTags: tags,
        }),
        deletePnf: builder.mutation<void, any>({
            query: (id) => crudApiTemplate(entity).deleteItem(id),
            invalidatesTags: tags,
        }),
    }),
});


export const {
    useListPnfQuery,
    useGetPnfQuery,
    useLazyGetPnfQuery,
    useGetPnfDataQuery,
    useAddPnfMutation,
    useUpdatePnfMutation,
    useDeletePnfMutation,
    useGetAllPnfQuery,
    useGetPnfEmailStatusQuery,
    useGetPnfStatusQuery,
    useGetPnfStatusCountQuery,
    usePnfReportQuery,
    useLazyPnfReportQuery,
    usePnfReportDataQuery,
    useLazyPnfReportDataQuery
} = pnfApi;
