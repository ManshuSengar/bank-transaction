import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Grid,
  Divider,
  Button,
  Tooltip,
  Tabs,
  Tab,
  Box,
  Alert,
  Typography,
} from '@mui/material';
import { Formik, Form, FormikProps } from 'formik';
import ErrorMessageGlobal from '../../../components/framework/ErrorMessageGlobal';
import { TextBoxField } from '../../../components/framework/TextBoxField';
import { PnfTextBoxField } from '../components/PnfTextBoxField';
import { defaultPnfInformation, pnfInformationSchema } from '../../../models/pnf/pnf';
import {
  useAddPnfMutation,
  useGetPnfQuery,
  useGetPnfEmailStatusQuery,
  useLazyPnfReportQuery,
  useLazyGetPnfQuery,
} from '../../../features/pnf/api';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { setDrawerState, setPnfStatus } from '../../../features/lead/leadSlice';
import { useLocation, useNavigate } from 'react-router-dom';
import { AiOutlineArrowLeft, AiOutlineFilePdf } from 'react-icons/ai';
import { MirPnfDropdown } from '../components/MirPnfDropdown';
import Section from '../../nbfc/Section';
import Workflow from '../../workflow/Workflow';
import { TabPanelProps } from '../../../models/tabPanel';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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

/* --------------------------------------------------------------------- */
/* --------------------------  MAIN COMPONENT  -------------------------- */
/* --------------------------------------------------------------------- */
const PnfForm = () => {
  const { pnfId } = useAppSelector((state: any) => state.userStore);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [tabValue, setTabValue] = useState(0);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

  const [isManualSave, setIsManualSave] = useState(false);
  const [newFiles, setNewFiles] = useState<any[]>([]);
  const [isNewRecord, setIsNewRecord] = useState(true);

  /* ----------  CONTROL REFETCHING WHILE SAVING  ---------- */
  const skipRefetch = useRef(false);

  /* ----------  LOAD PNF ONLY ONCE (or after successful save) ---------- */
  const {
    data: initialPnfData,
    isLoading: pnfLoading,
    refetch: refetchPnf,
  } = useGetPnfQuery(pnfId, {
    skip: !pnfId,
    refetchOnMountOrArgChange: !skipRefetch.current,
  });

  const { userData } = useAppSelector((state: any) => state.userStore);
  const { data: oldWorkflowDetails } = useGetOldWorkflowDetailsQuery(
    { formId: pnfId, formType: 'PNF' },
    { skip: !pnfId, refetchOnMountOrArgChange: true }
  );

  const [getPnfLazy] = useLazyGetPnfQuery();
  const [checkWorkflow] = useLazyGetWorkflowDetailsQuery();
  const [generateReport] = useLazyPnfReportQuery();
  const [addPnf] = useAddPnfMutation();

  const loginCookies = JSON.parse(Cookies.get('user') || '{}');

  /* ----------  INITIAL SIDE-EFFECTS  ---------- */
  useEffect(() => {
    if (location.pathname.includes('pnf')) dispatch(setDrawerState(false));
    if (location?.state?.id) dispatch(setPNFIdData(location.state.id));
  }, [location, dispatch]);

  /* ----------  TAB CHANGE → RE-ENABLE REFETCH  ---------- */
  useEffect(() => {
    if (tabValue === 0 && pnfId) skipRefetch.current = false;
  }, [tabValue, pnfId]);

  /* ----------  SAVE / SUBMIT HANDLER  ---------- */
  const handleSave = useCallback(
    async (status: '01' | '02', formik: FormikProps<any>) => {
      const { values, validateForm, setSubmitting } = formik;
      setIsManualSave(true);
      skipRefetch.current = true; // block refetch while saving

      const errors = await validateForm();
      if (Object.keys(errors).length) {
        setSnackMsg('Please fix form errors.');
        setSnackSeverity('error');
        setSnackOpen(true);
        setSubmitting(false);
        setIsManualSave(false);
        skipRefetch.current = false;
        return;
      }

      try {
        /* ---- workflow check for submit ---- */
        if (status === '02') {
          const wf = await checkWorkflow({ formId: pnfId, formType: 'PNF' }).unwrap();
          if (!wf || wf.length < 2) {
            setSnackMsg('Please assign workflow before submitting.');
            setSnackSeverity('error');
            setSnackOpen(true);
            setSubmitting(false);
            setIsManualSave(false);
            skipRefetch.current = false;
            return;
          }
        }

        const payload = {
          ...values,
          pnfId: pnfId || undefined,
          status,
          makerId: userData?.userId,
          pnfDoc: newFiles,
        };

        const resp: any = pnfId
          ? await addPnf({ ...payload, pnfId }).unwrap()
          : await addPnf(payload).unwrap();

        const newId = resp?.pnfId;
        if (!pnfId) dispatch(setPNFIdData(newId));

        /* ---- upload docs ---- */
        for (const f of newFiles) {
          await UploadAPI.updateDoc({ pnfId: newId, slNo: f.slNo }, '/pnf/updatePnfDoc');
        }

        /* ---- RE-ENABLE REFETCH & REFRESH DATA ---- */
        skipRefetch.current = false;
        await getPnfLazy(newId).unwrap();

        setIsNewRecord(false);
        dispatch(setPnfStatus(status));

        setSnackMsg(status === '01' ? 'Saved as draft!' : 'PNF Submitted Successfully!');
        setSnackSeverity('success');
        setSnackOpen(true);
      } catch (e: any) {
        setSnackMsg(e?.data?.message || 'Operation failed.');
        setSnackSeverity('error');
        setSnackOpen(true);
        skipRefetch.current = false;
      } finally {
        setSubmitting(false);
        setIsManualSave(false);
      }
    },
    [pnfId, userData, newFiles, dispatch, addPnf, checkWorkflow, getPnfLazy]
  );

  /* ----------  AUTO-SAVE  ---------- */
  const handleAutoSave = async (values: any) => {
    skipRefetch.current = true;
    try {
      const payload = {
        ...values,
        pnfId: pnfId || undefined,
        status: '01',
        makerId: userData?.userId,
        pnfDoc: newFiles,
      };

      const resp: any = pnfId
        ? await addPnf({ ...payload, pnfId }).unwrap()
        : await addPnf(payload).unwrap();

      const newId = resp?.pnfId;
      if (!pnfId) dispatch(setPNFIdData(newId));

      for (const f of newFiles) {
        await UploadAPI.updateDoc({ pnfId: newId, slNo: f.slNo }, '/pnf/updatePnfDoc');
      }

      skipRefetch.current = false;
      setIsNewRecord(false);
      return true;
    } catch {
      skipRefetch.current = false;
      return false;
    }
  };

  /* ----------  VIEW REPORT  ---------- */
  const handleViewReport = async () => {
    try {
      const { repData }: any = await generateReport(pnfId).unwrap();
      const blob = new Blob([Uint8Array.from(atob(repData), c => c.charCodeAt(0))], {
        type: 'application/pdf',
      });
      window.open(URL.createObjectURL(blob));
    } catch {
      setSnackMsg('Failed to generate report.');
      setSnackSeverity('error');
      setSnackOpen(true);
    }
  };

  if (isManualSave) return <FullScreenLoaderNoClose />;

  return (
    <Grid container className="los_mainwra">
      <Grid item xs={12} className="los_rgtdata">
        <div className="wrap-appraisal-area">
          <Section>
            <Box className="wrap-tabs" sx={{ width: '100%' }}>
              {/* ---------- TABS ---------- */}
              <Box className="tab-with-btn ps-0" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tooltip arrow title="Back to PNF Dashboard" placement="top">
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => navigate('/los/pnf-dashboard')}
                  >
                    <AiOutlineArrowLeft className="me-0" /> Back
                  </Button>
                </Tooltip>

                <Tabs
                  value={tabValue}
                  onChange={(_, v) => setTabValue(v)}
                  aria-label="pnf tabs"
                >
                  <Tab className="tab-ui" label="PNF Form" {...a11yProps(0)} />
                  <Tab className="tab-ui" label="Workflow" {...a11yProps(1)} />
                  {oldWorkflowDetails?.length ? (
                    <Tab className="tab-ui" label="Workflow History" {...a11yProps(2)} />
                  ) : null}
                </Tabs>
              </Box>

              {/* ---------- FORM TAB ---------- */}
              <CustomTabPanel value={tabValue} index={0}>
                <ErrorMessageGlobal status={null} />
                <Section>
                  <div className="custome-form">
                    <div className="d-flex justify-content-end mb-3">
                      {pnfId ? (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<AiOutlineFilePdf />}
                          onClick={handleViewReport}
                        >
                          View Report
                        </Button>
                      ) : (
                        <Button variant="contained" size="small" disabled>
                          <AiOutlineFilePdf /> Fill details to view report
                        </Button>
                      )}
                    </div>

                    <Formik
                      initialValues={initialPnfData || defaultPnfInformation}
                      validationSchema={pnfInformationSchema}
                      onSubmit={() => {}}
                      enableReinitialize={false}   {/* ← NEVER RE-INIT AFTER FIRST LOAD */}
                      validateOnMount={false}
                    >
                      {formik => {
                        const { values, isSubmitting } = formik;
                        const canEdit =
                          (values.status === '01' || values.status === '05') &&
                          loginCookies?.regType === 'Maker';

                        const { data: emailDup, isFetching: checkingEmail } = useGetPnfEmailStatusQuery(
                          { id: values.nominationEmailId, pnfId },
                          { skip: !values.nominationEmailId || !pnfId }
                        );

                        const blockSave = isSubmitting || emailDup === true;

                        return (
                          <Form>
                            {canEdit && (
                              <AutoSave
                                debounceMs={5000}
                                handleSubmit={handleAutoSave}
                                values={values}
                              />
                            )}

                            <Grid container spacing={2} padding={4} className="form-grid pt-0 pb-0">
                              {/* ---------- MIR DETAILS ---------- */}
                              <Grid item xs={12}>
                                <Divider className="mt-0 mb-3" textAlign="left">
                                  <span className="seperator-ui">MIR Details</span>
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

                              {/* ---------- NOMINATED PERSONNEL ---------- */}
                              <Grid item xs={12}>
                                <Divider className="mt-4 mb-3" textAlign="left">
                                  <span className="seperator-ui">Details of Nominated Personnel</span>
                                </Divider>
                                <Alert severity="warning" className="mb-3">
                                  <strong>Note:</strong> User ID will be generated from the{' '}
                                  <strong>Official Email Id</strong> field.
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
                                  <Typography variant="caption" color="textSecondary">
                                    Checking...
                                  </Typography>
                                ) : emailDup ? (
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

                              {/* ---------- AUTHORISED SIGNATORY ---------- */}
                              <Grid item xs={12}>
                                <Divider className="mt-4 mb-3" textAlign="left">
                                  <span className="seperator-ui">Details of Authorized Signatory</span>
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
                                <TextBoxField label="Acting on Behalf of *" name="authBehalf" disabled />
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

                              {/* ---------- FILE UPLOAD ---------- */}
                              <Grid item xs={6} className="pt-3">
                                <MultiFileUpload
                                  initialFiles={values.pnfDoc || []}
                                  onFileChange={setNewFiles}
                                  disabled={!canEdit}
                                  isNew={isNewRecord}
                                  isFrom="pnf"
                                />
                              </Grid>

                              {/* ---------- SAVE / SUBMIT BUTTONS ---------- */}
                              <Grid item xs={12} textAlign="right">
                                {canEdit && (
                                  <>
                                    <Button
                                      variant="contained"
                                      size="small"
                                      className="text-capitalize sbmtBtn me-2"
                                      onClick={() => handleSave('01', formik)}
                                      disabled={blockSave}
                                    >
                                      {initialPnfData ? (
                                        <>Save <BrowserUpdatedIcon /></>
                                      ) : (
                                        <>Save as Draft <SaveAsIcon /></>
                                      )}
                                    </Button>

                                    {initialPnfData && (
                                      <Button
                                        variant="contained"
                                        size="small"
                                        className="text-capitalize sbmtBtn sbmtBtn_scn"
                                        onClick={() => handleSave('02', formik)}
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

              {/* ---------- WORKFLOW TAB ---------- */}
              <CustomTabPanel value={tabValue} index={1}>
                <Workflow formIdVal={pnfId} formTypeVal="PNF" />
              </CustomTabPanel>

              {/* ---------- HISTORY TAB ---------- */}
              {oldWorkflowDetails?.length ? (
                <CustomTabPanel value={tabValue} index={2}>
                  <OldWorkFlowMain value={tabValue} oldWorkflowDetails={oldWorkflowDetails} />
                </CustomTabPanel>
              ) : null}
            </Box>
          </Section>
        </div>

        <NbfcSnackbar
          open={snackOpen}
          msg={snackMsg}
          severity={snackSeverity}
          handleSnackClose={() => setSnackOpen(false)}
          submitCall={false}
        />
      </Grid>
    </Grid>
  );
};

export default PnfForm;


import React, { useEffect, useMemo } from 'react';
import { Grid, TextField, Autocomplete, Typography } from '@mui/material';
import { getIn, useFormikContext } from 'formik';
import { useGetMaterQuery } from '../../../features/master/api';
import { useGetMirQuery } from '../../../features/mir/api';
import { modify } from '../../../utlis/helpers';

export const MirPnfDropdown = (props: {
  label?: string;
  name: string;
  disabled?: boolean;
}) => {
  const { setFieldValue, values, touched, errors, handleBlur } = useFormikContext<any>();

  const selectedMirId = getIn(values, props.name);

  /* ---- MIR LIST (cached) ---- */
  const {
    data: masterData,
    isLoading: masterLoading,
  } = useGetMaterQuery('refapi/mir/getMirPnfList', {
    refetchOnMountOrArgChange: true,
  });

  /* ---- MIR DETAIL (only when id changes) ---- */
  const {
    data: mirInfo,
    isLoading: mirLoading,
  } = useGetMirQuery(selectedMirId, {
    skip: !selectedMirId,
  });

  const options = useMemo(() => {
    return (
      modify('mir/getMirPnfList', masterData)?.map((i: any) => ({
        key: i.key,
        value: i.key,
        label: i.label,
      })) ?? []
    );
  }, [masterData]);

  /* ---- Populate dependent fields only when MIR changes ---- */
  useEffect(() => {
    if (!mirInfo || !selectedMirId) return;
    setFieldValue('custDetails', mirInfo?.customerDetails);
    setFieldValue('customerName', mirInfo?.nbfcName);
    setFieldValue('authBehalf', mirInfo?.nbfcName);
    setFieldValue('businessNature', mirInfo?.businessNature);
    setFieldValue('loanPurpose', mirInfo?.loanPurpose);
    setFieldValue('pan', mirInfo?.panNo);
    setFieldValue('nbfcId', mirInfo?.nbfcId);
    setFieldValue('cifCd', mirInfo?.cifCd);
  }, [mirInfo, selectedMirId, setFieldValue]);

  const current = options.find(o => o.value == selectedMirId) ?? null;

  return (
    <Grid item xs={12}>
      <Autocomplete
        fullWidth
        options={options}
        value={current}
        disabled={props.disabled || masterLoading}
        loading={masterLoading || mirLoading}
        onChange={(_, nv) => setFieldValue(props.name, nv ? nv.value : null)}
        onBlur={handleBlur}
        getOptionLabel={opt => opt.label}
        renderInput={params => (
          <TextField
            {...params}
            label={props.label}
            variant="outlined"
            error={Boolean(getIn(touched, props.name) && getIn(errors, props.name))}
            helperText={
              getIn(touched, props.name) && getIn(errors, props.name)
                ? String(getIn(errors, props.name))
                : ''
            }
          />
        )}
        isOptionEqualToValue={(o, v) => o.value === v?.value}
      />
    </Grid>
  );
};
















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
            return total + (data1.sanctionedLimit || 0);
        }, 0);
    };

    const calculateNcdTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (data1.ncdOs || 0);
        }, 0);
    };

    const calculatetotalExposureTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (data1.totalExposure || 0);
        }, 0);
    };

    const odListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                lenderName: Yup.string().required('Required'),
                limitType: Yup.string().required('Required'),
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
                                        const selected = limitTypeOptions.find(opt => opt.value === value);
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
                                        setFieldValue(`data.${index}.totalExposure`, numValue);
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
                                        setFieldValue(`data.${index}.totalExposure`, numValue);
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
                                                                                {i === 4 && <b>Sanctioned Limit (` crore)</b>}
                                                                                {i === 5 && <b>Amount Outstanding (` crore)</b>}
                                                                                {i === 6 && <b>Total Exposure (` crore)</b>}
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
                                                                            <b>{sanTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[5]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{ncdTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[6]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{exposureTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
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
import { AdvanceTextBoxField } from "../../../components/framework/AdvanceTextBoxField"; // Assuming the path to AdvanceTextBoxField

interface LenderRow {
    lenderName: string;
    limitType: string;
    sanctionedLimit: number | null;
    totalExposure: number | null;
    latestIntRate: number | null;
    contactDetails: string;
    ncdOs: number | null; // Changed to number | null for consistency
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
                ncdOs: item.ncdOs ? parseFloat(item.ncdOs) : null, // Ensure number
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
            return total + (data1.sanctionedLimit || 0);
        }, 0);
    };

    const calculateNcdTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (data1.ncdOs || 0);
        }, 0);
    };

    const calculatetotalExposureTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (data1.totalExposure || 0);
        }, 0);
    };
    const odListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                lenderName: Yup.string().required('Required'),
                limitType: Yup.string().required('Required'),
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
                                        const selected = limitTypeOptions.find(opt => opt.value === value);
                                        if (selected) {
                                            const expType = selected.totalExposure;
                                            const sanLimit = row.sanctionedLimit || null;
                                            const amtOut = row.ncdOs || null;
                                            const totalExp = expType === 'SL' ? sanLimit : amtOut;
                                            setFieldValue(`data.${index}.totalExposure`, totalExp);
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
                                        setFieldValue(`data.${index}.totalExposure`, numValue);
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
                                        setFieldValue(`data.${index}.totalExposure`, numValue);
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
                                                                                {i === 4 && <b>Sanctioned Limit (` crore)</b>}
                                                                                {i === 5 && <b>Amount Outstanding (` crore)</b>}
                                                                                {i === 6 && <b>Total Exposure (` crore)</b>}
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
                                                                            <b>{sanTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[5]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{ncdTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[6]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{exposureTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
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
    limitType: string;
    sanctionedLimit: number | null;
    totalExposure: number | null;
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

    const columnWidths = [60, 60, 150, 250, 170, 180, 170, 320, 120, 120];

    useEffect(() => {
        if (LimitData) {
            const dataWithApplId: LenderRow[] = LimitData.map((item: any) => ({
                ...item,
                applId,
                totalExposure: item.totalExposure === "SL" ? item.sanctionedLimit : item.ncdOs // Initialize totalExposure
            }));
            setInitialValues({ data: dataWithApplId });
        }
    }, [LimitData, applId]);

    useEffect(() => {
        if (excelData && excelData.length > 0) {
            let newExcelData = excelData.slice(1);
            const lenderRows = newExcelData.filter((row: any) => row[2] && row[2] !== 'Total');
            const newData: LenderRow[] = lenderRows.map((excelRow: any) => {
                const limitType = excelRow[3]?.toString().trim() || "";
                const sanctionedLimit = parseExcelValue(excelRow[5]);
                const ncdOs = parseExcelValue(excelRow[13]);
                const totalExposure = limitTypeOptions.find(opt => opt.value === limitType)?.totalExposure === "SL" ? sanctionedLimit : ncdOs;
                return {
                    lenderName: excelRow[2]?.toString().trim() || "",
                    limitType,
                    sanctionedLimit,
                    totalExposure,
                    latestIntRate: parseExcelValue(excelRow[11]),
                    contactDetails: excelRow[12]?.toString().trim() || "",
                    ncdOs,
                    security: excelRow[14]?.toString().trim() || "",
                    slNo: null,
                    saveStatus: '01',
                    applId
                };
            });
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
            return total + (parseFloat(data1.sanctionedLimit) || 0);
        }, 0);
    };

    const calculateNcdTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1.ncdOs) || 0);
        }, 0);
    };

    const calculatetotalExposureTotal = (values: FormValues): number => {
        return values.data.reduce((total: number, data1: any) => {
            return total + (parseFloat(data1.totalExposure) || 0);
        }, 0);
    };

    const odListingSchema = Yup.object().shape({
        data: Yup.array().of(
            Yup.object().shape({
                lenderName: Yup.string().required('Required'),
                limitType: Yup.string().required('Required'),
                sanctionedLimit: Yup.number().nullable(),
                ncdOs: Yup.string().nullable(),
                latestIntRate: Yup.number().nullable(),
                contactDetails: Yup.string().nullable(),
                security: Yup.string().nullable(),
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

        // Update totalExposure based on limitType
        useEffect(() => {
            if (selectedLimitType) {
                const totalExposureValue = selectedLimitType.totalExposure === "SL"
                    ? row.sanctionedLimit
                    : parseFloat(row.ncdOs) || 0;
                setFieldValue(`data.${index}.totalExposure`, totalExposureValue);
            }
        }, [row.limitType, row.sanctionedLimit, row.ncdOs, selectedLimitType, setFieldValue]);

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
                                        setFieldValue(`data.${index}.limitType`, value);
                                        // Trigger totalExposure update
                                        const selectedOption = limitTypeOptions.find(opt => opt.value === value);
                                        const totalExposureValue = selectedOption?.totalExposure === "SL"
                                            ? row.sanctionedLimit
                                            : parseFloat(row.ncdOs) || 0;
                                        setFieldValue(`data.${index}.totalExposure`, totalExposureValue);
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
                            <TextBoxField
                                name={`data.${index}.sanctionedLimit`}
                                type="number"
                                onChange={(e) => {
                                    setFieldValue(`data.${index}.sanctionedLimit`, e.target.value);
                                    if (selectedLimitType?.totalExposure === "SL") {
                                        setFieldValue(`data.${index}.totalExposure`, e.target.value);
                                    }
                                }}
                            />
                        )}
                        {colIndex === 5 && (
                            <TextBoxField
                                name={`data.${index}.totalExposure`}
                                type="number"
                                disabled={true}
                            />
                        )}
                        {colIndex === 6 && (
                            <TextBoxField
                                name={`data.${index}.latestIntRate`}
                                type="number"
                            />
                        )}
                        {colIndex === 7 && (
                            <TextBoxField
                                name={`data.${index}.contactDetails`}
                            />
                        )}
                        {colIndex === 8 && (
                            <TextBoxField
                                name={`data.${index}.ncdOs`}
                                type="number"
                                onChange={(e) => {
                                    setFieldValue(`data.${index}.ncdOs`, e.target.value);
                                    if (selectedLimitType?.totalExposure === "AO") {
                                        setFieldValue(`data.${index}.totalExposure`, e.target.value);
                                    }
                                }}
                            />
                        )}
                        {colIndex === 9 && (
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
                                                                                {i === 2 && <b>Limit Type</b>}
                                                                                {i === 3 && <b>Name of the Bank/ lender</b>}
                                                                                {i === 4 && <b>Sanctioned Limit (` crore)</b>}
                                                                                {i === 5 && <b>Total Exposure (` crore)</b>}
                                                                                {i === 6 && <b>Latest rate of interest</b>}
                                                                                {i === 7 && <b>Contact details of lenders</b>}
                                                                                {i === 8 && <b>Amount Outstanding (` crore)</b>}
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
                                                                            <b>{sanTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[5]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{exposureTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
                                                                        <div style={{ width: `${columnWidths[6]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[7]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                                                        <div style={{ width: `${columnWidths[8]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                                                            <b>{ncdTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                                                        </div>
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
