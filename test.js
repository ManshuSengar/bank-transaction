import { FieldArray, Form, Formik } from "formik";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Alert, Button, Grid, IconButton, Snackbar, Table, TableCell, TableHead, TableRow } from "@mui/material";
import { Delete } from '@mui/icons-material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import { FixedSizeList } from 'react-window';
import { connect } from 'react-redux';
import { useDeleteLenderTermLoanByIdMutation, useGetLenderTermLoanFormDataQuery, useSaveLenderTermLoanFormDataMutation } from "../../../features/application-form/capitalResourceForm";
import AutoSave from "../../../components/framework/AutoSave";
import { TextBoxField } from "../../../components/framework/TextBoxField";
import FormLoader from "../../../loader/FormLoader";
import { EnhancedDropDown } from "../../../components/framework/EnhancedDropDown";
import { AdvanceDatePickerField } from "../../../components/framework/EnhancedComponents";
import ConfirmationAlertDialog from "../../../models/application-form/ConfirmationAlertDialog";
import { OnlineSnackbar } from "../../../components/shared/OnlineSnackbar";
import { MultipleLenderDropDown } from "../commonFiles/MultipleLenderDropDown";
import { AdvanceTextBoxField } from "../../../components/framework/AdvanceTextBoxField";
import FullScreenLoaderNoClose from "../../../components/common/FullScreenLoaderNoClose";
import { useGetMaterQuery } from "../../../features/master/api";
import { modify } from "../../../utlis/helpers";
import * as Yup from 'yup';
import { parse, differenceInDays, isValid, format } from 'date-fns';

import NotificationSectionWiseButton from "../../../components/DrawerComponent/NotificationSectionWiseButton";
import DrawerResponseComponent from "../../../components/DrawerComponent/DrawerResponseComponent";
import { useGetBriefApplDetailsDataQuery, useUpdateCommentByNIdMutation } from "../../../features/application-form/applicationForm";
import Notification from "../../../components/shared/Notification";
import { useAppSelector } from "../../../app/hooks";
interface LenderRow {
  lenderName: string;
  lenderType: string | null;
  sancDt: string | null;
  sancAmt: number | null;
  disbDt: string | null;
  disbAmt: number | null;
  undrawnSanc: number | null;
  outstandingAmt: number | null;
  totalExposure: number | null;
  intRate: number | null;
  tenure: number | null;
  contactDetails: string | null;
  acr: number | null;
  security: string;
  corpGuarantee: string;
  persGuarantee: string;
  collSecurity: string;
  majorCovenants: string;
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

const LenderTermLoanForm = ({ applId, excelData, openSectionsData }: Props) => {
  const { data: appDetails } = useGetBriefApplDetailsDataQuery(applId as any, { skip: !applId, refetchOnMountOrArgChange: true });
  const [addLimitTlDetails] = useSaveLenderTermLoanFormDataMutation();
  const [deleteLimitTlDetails] = useDeleteLenderTermLoanByIdMutation();
  const { data: LimitTlData, isLoading, isError, refetch } = useGetLenderTermLoanFormDataQuery(applId, { skip: !applId, refetchOnMountOrArgChange: true });

  const [index, setIndex] = useState(0);
  const [initialValues, setInitialValues] = useState<FormValues>({ data: [] });
  const [openConfirmation, setOpenConfirmation] = useState(false);
  const [formData, setFormData] = useState<LenderRow[] | null>(null);
  const [actionVal, setActionVal] = useState<string | null>(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [severity, setSeverity] = useState<"success" | "error">("success");
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackSeverity, setSnackSeverity] = useState<"error" | "success" | "info">("error");
  const [snackMessages, setSnackMessages] = useState<string[]>([]);


  const columnWidths = [60, 60, 250, 150, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 350, 350, 350, 350];

  const formatDate = (str: string | null): string => {
    if (!str) return "";
    if (typeof str === "string") return str;
    const date = new Date(str);
    const mnth = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return [day, mnth, date.getFullYear()].join("-");
  };

  useEffect(() => {
    if (LimitTlData) {
      const dataWithApplId: LenderRow[] = LimitTlData.map((item: any) => ({ ...item, applId }));
      setInitialValues({ data: dataWithApplId });
    }
  }, [LimitTlData, applId]);

  useEffect(() => {
    if (excelData && excelData.length > 0) {
      setIsProcessing(true);
      const lenderRows = excelData.filter((row: any, idx: number) => idx !== 0 && row[2] !== 'Total');
      const newData: LenderRow[] = lenderRows.map((excelRow: any) => ({
        lenderName: excelRow[2]?.toString().trim() || "",
        lenderType: excelRow[3]?.toString().trim() || null,
        sancDt: formatDate(excelRow[4]),
        sancAmt: parseExcelValue(excelRow[5]),
        disbDt: formatDate(excelRow[6]),
        disbAmt: parseExcelValue(excelRow[7]),
        undrawnSanc: parseExcelValue(excelRow[8]),
        outstandingAmt: parseExcelValue(excelRow[9]),
        totalExposure: calculateTotalExposure(parseExcelValue(excelRow[8]), parseExcelValue(excelRow[9])),
        intRate: parseExcelValue(excelRow[11]),
        tenure: parseExcelValue(excelRow[12]),
        contactDetails: excelRow[13]?.toString().trim() || null,
        acr: parseExcelValue(excelRow[14]),
        security: excelRow[15]?.toString().trim() || "",
        corpGuarantee: excelRow[16]?.toString().trim() || "",
        persGuarantee: excelRow[17]?.toString().trim() || "",
        collSecurity: excelRow[18]?.toString().trim() || "",
        majorCovenants: excelRow[19]?.toString().trim() || "",
        slNo: null,
        saveStatus: '01',
        applId,
      }));
      setTimeout(() => {
        setInitialValues({ data: newData });
        setIsProcessing(false);
        setOpenSnackbar(true);
        setSeverity("success");
        setSnackMsg("Lender data imported successfully");
      }, 0);
    }
  }, [excelData, applId]);

  const parseExcelValue = (value: any): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'string') return parseFloat(value.replace(/,/g, '')) || 0;
    return parseFloat(value) || 0;
  };

  const extractErrorMessages = (errorResponse: Record<string, string>): string[] => {
    return Object.values(errorResponse).flatMap(msg => msg.split(',').map(m => m.trim()));
  };

  const handleSubmitApis = async (values: FormValues | LenderRow[]) => {
    try {
      const requestBody = Array.isArray(values) ? values : values.data;
      setIsUploading(true);
      if (await addLimitTlDetails(requestBody).unwrap()) {
        setIsUploading(false);
        setOpenSnackbar(true);
        setSeverity("success");
        setSnackMsg(requestBody[0]?.saveStatus === '02' ? "Section submitted successfully" : "Record saved successfully");
        setActionVal(null);
        return true;
      }
      return false;
    } catch (err: any) {
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

  const handleDelete = async (applId: string, index: number) => {
    handleClose();
    try {
      if (await deleteLimitTlDetails({ applId, index }).unwrap()) {
        setOpenSnackbar(true);
        setSeverity("success");
        setSnackMsg("Record Deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      setOpenSnackbar(true);
      setSeverity("error");
      setSnackMsg("Failed to delete");
    }
  };

  const handleClickOpen = (index: number) => {
    setIndex(index);
    setOpen(true);
  };

  const calculateSanTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.sancAmt as any) || 0), 0);
  const calculateDisbTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.disbAmt as any) || 0), 0);
  const calculateUndrawnSanctionTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.undrawnSanc as any) || 0), 0);
  const calculateOutStTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.outstandingAmt as any) || 0), 0);
  const calculateExpoTotal = (values: FormValues): number => values.data.reduce((total, data1) => total + (parseFloat(data1.totalExposure as any) || 0), 0);

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
    const finalValue = values.data.map((listData, index) => ({
      ...listData,
      applId,
      slNo: index + 1,
      saveStatus: actionVal || '',
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

  const calculateTotalExposure = (outstandingAmt: number | null, undrawnSanc: number | null): number => {
    const outstanding = parseFloat(outstandingAmt?.toString() || '0') || 0;
    const undrawn = parseFloat(undrawnSanc?.toString() || '0') || 0;
    return outstanding + undrawn;
  };

  const handleFieldChange = useCallback((index: number, field: string, value: any, setFieldValue: any, values: FormValues) => {
    setFieldValue(`data.${index}.${field}`, value);
    if (field === 'outstandingAmt' || field === 'undrawnSanc') {
      const currentRow = values.data[index];
      const outstandingAmt = field === 'outstandingAmt' ? value : currentRow.outstandingAmt;
      const undrawnSanc = field === 'undrawnSanc' ? value : currentRow.undrawnSanc;
      const newTotalExposure = calculateTotalExposure(outstandingAmt, undrawnSanc);
      setFieldValue(`data.${index}.totalExposure`, newTotalExposure);
    }
  }, []);

  const handleSnackbarCloseSnack = () => setSnackOpen(false);

  const { data: bankMasterData, isLoading: isBankMasterLoading } = useGetMaterQuery(`refapi/mstr/getBankMasters`);
  const bankOptions = useMemo(() => bankMasterData ? modify("mstr/getBankMasters", bankMasterData) : [], [bankMasterData]);

  const { data: lenderTypeData, isLoading: isLenderTypeLoading } = useGetMaterQuery(`refapi/mstr/getLenderType`);
  const lenderTypeOptions = useMemo(() => lenderTypeData ? modify("mstr/getLenderType", lenderTypeData) : [], [lenderTypeData]);

  // const handleDisbDateChange = (newDate: Date | null, index: number, setFieldValue: (field: string, value: any) => void) => {
  //   // console.log(index, 'index', 'field value =>', `data[${index}].disbDt`);
  //   console.log('newDate', newDate);
  // }
  const handleDisbDateChange = (
    date: Date | null,
    index: number,
    setFieldValue: any,
    validateForm: any
  ) => {
    if (!date) return;

    const formatted = format(date, 'dd-MM-yyyy');
    setFieldValue(`data.${index}.disbDt`, [formatted]); // store array format

    // ✅ Trigger full revalidation after date change
    setTimeout(() => validateForm(), 0);
  };

  // Utility: safely parse the API date (handles multiple formats)
  const parseAppSubmitDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;

    // Try parsing with expected format
    let parsed = parse(dateStr, 'yyyy-MM-dd HH:mm:ss.S', new Date());
    if (!isValid(parsed)) {
      // Try fallback format (in case backend returns slightly different)
      parsed = parse(dateStr, 'yyyy-MM-dd HH:mm:ss', new Date());
    }
    if (!isValid(parsed)) {
      // Try final fallback
      parsed = new Date(dateStr);
    }

    return isValid(parsed) ? parsed : null;
  };

  const appSubmitDt: any = parseAppSubmitDate(appDetails?.submitDate);
  console.log('appSubmitDt', appSubmitDt);

  // Helper: check if disbDt - submitDate <= 180
const isWithin180Days = (disbDtArray: any | string, submitDateStr?: any): boolean => {
  try {
    if (!disbDtArray || !submitDateStr) return false;

    const disbStr = Array.isArray(disbDtArray) ? disbDtArray[0] : disbDtArray;
    if (!disbStr) return false;

    // Try multiple formats for flexibility
    const disbDate = parse(disbStr, 'dd-MM-yyyy', new Date());
    const cleanSubmitDate = submitDateStr?.split('.')[0] || submitDateStr;
    const submitDate = parse(cleanSubmitDate, 'yyyy-MM-dd HH:mm:ss', new Date());

    if (!isValid(disbDate) || !isValid(submitDate)) return false;

    const diff = differenceInDays(disbDate, submitDate);
    console.log('diff', diff);
    return diff <= 180;
  } catch (err) {
    console.error('isWithin180Days error:', err);
    return false;
  }
};

  // ✅ Term Loan Schema
  const termLoanListingSchema = (appSubmitDtStr: string) =>
    Yup.object().shape({
      data: Yup.array().of(
        Yup.object().shape({
          // Always required
          lenderName: Yup.string()
            .min(3, 'Lender Name must be at least 3 characters')
            .max(255, 'Lender Name cannot exceed 255 characters')
            .required('Required'),
          lenderType: Yup.string()
            .max(255, 'Lender Type cannot exceed 255 characters')
            .required('Required'),
          acr: Yup.string()
            .required('Required')
            .matches(/^[0-9.]+$/, 'ACR must be a number')
            .test('positive', 'ACR must be between 0-2', val =>
              val ? Number(val) > 0 && Number(val) <= 2 : false
            ),
          sancAmt: Yup.number().required('Required'),
          disbAmt: Yup.number()
            .required('Required')
            .test(
              'is-not-greater-than-value1',
              'Disbursement Amt. cannot be greater than Sanction Amt.',
              function (value) {
                const { sancAmt } = this.parent;
                return value <= sancAmt;
              }
            ),

          // Conditionally required only if disbDt - submitDate <= 180
          sancDt: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Sanction Date is required')
              : schema.notRequired()
          ),
          undrawnSanc: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Undrawn Sanction is required')
              : schema.notRequired()
          ),
          outstandingAmt: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Outstanding Amount is required')
              : schema.notRequired()
          ),
          totalExposure: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Total Exposure is required')
              : schema.notRequired()
          ),
          intRate: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Interest Rate is required')
              : schema.notRequired()
          ),
          tenure: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Tenure is required')
              : schema.notRequired()
          ),
          contactDetails: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Contact Detail is required')
              : schema.notRequired()
          ),
          security: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Security is required')
              : schema.notRequired()
          ),
          corpGuarantee: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Corporate Guarantee is required')
              : schema.notRequired()
          ),
          persGuarantee: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Personal Guarantee is required')
              : schema.notRequired()
          ),
          collSecurity: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Collateral Security is required')
              : schema.notRequired()
          ),
          majorCovenants: Yup.string().when('disbDt', (disbDt:any, schema:any) =>
            isWithin180Days(disbDt, appSubmitDtStr)
              ? schema.required('Major Covenants are required')
              : schema.notRequired()
          ),
        })
      ),
    });



  const renderRow = ({ index, style, data }: { index: number; style: any; data: { values: FormValues; setFieldValue: any, validateForm: any, validateField: any } }) => {
    const { values, setFieldValue, validateForm, validateField } = data;
    const row = values.data[index];
    return (
      <div style={{ ...style, display: 'flex' }} className="div-table-row">
        {columnWidths.map((width, colIndex) => (
          <div key={colIndex} style={{ width: `${width}px`, flexShrink: 0, padding: '8px' }} className="div-table-cell">
            {colIndex === 0 && (
              <IconButton className="text-danger" disabled={row.saveStatus === '02'} onClick={() => row.slNo ? handleClickOpen(row.slNo) : values.data.splice(index, 1)}>
                <Delete />
              </IconButton>
            )}
            {colIndex === 1 && <p>{index + 1}</p>}
            {colIndex === 2 && (
              <MultipleLenderDropDown
                label=""
                name={`data.${index}.lenderName`}
                domain=""
                disabled={row.saveStatus === '02'}
                options={bankOptions}
                isLoading={isBankMasterLoading}
              />
            )}
            {colIndex === 3 && (
              <EnhancedDropDown
                label=""
                name={`data.${index}.lenderType`}
                disabled={row.saveStatus === '02'}
                customOptions={lenderTypeOptions}
                domain=""
              />
            )}
            {colIndex === 4 && (
              <AdvanceDatePickerField
                label=""
                name={`data.${index}.sancDt`}
                disableFuture={true}

              />
            )}


            {colIndex === 5 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.sancAmt`}
                type="number"
                onCustomChange={(value: any) => {
                  handleFieldChange(index, 'sancAmt', value, setFieldValue, values);
                  const disbAmt = values.data[index].disbAmt || 0;
                  setFieldValue(`data.${index}.undrawnSanc`, value - disbAmt);
                }}
              />
            )}
            {colIndex === 6 && (
              <>
                {/* <AdvanceDatePickerField
                  label=""
                  name={`data.${index}.disbDt`}
                  disableFuture={true}
                  onChange={date => {
                    console.log('index', index, 'date', date);
                    handleDisbDateChange(date, index, setFieldValue)
                  }}
                  onDateChange={date => {
                    console.log('index', index, 'date', date);
                    handleDisbDateChange(date, index, setFieldValue)
                  }}
                /> */}

                <AdvanceDatePickerField
                  key={index}
                  label=""
                  name={`data.${index}.disbDt`}
                  disableFuture={true}
                  onChange={(date) => {
                    //handleDisbDateChange(date, index, setFieldValue, validateForm)
                    const formatted = date
                      ? `${date.getDate().toString().padStart(2, '0')}-${(
                        date.getMonth() + 1
                      )
                        .toString()
                        .padStart(2, '0')}-${date.getFullYear()}`
                      : '';
                    console.log('formatted', formatted);
                    // setFieldValue(`data.${index}.disbDt`, [formatted]);
                    // validate only conditional fields for this row
                    validateField(`data.${index}.sancDt`);
                    validateField(`data.${index}.undrawnSanc`);
                    validateField(`data.${index}.outstandingAmt`);
                    validateField(`data.${index}.totalExposure`);
                    validateField(`data.${index}.intRate`);
                    validateField(`data.${index}.tenure`);
                    validateField(`data.${index}.contactDetails`);
                    validateField(`data.${index}.security`);
                    validateField(`data.${index}.corpGuarantee`);
                    validateField(`data.${index}.persGuarantee`);
                    validateField(`data.${index}.collSecurity`);
                    validateField(`data.${index}.majorCovenants`);
                  }
                  }
                  onDateChange={(date) => {
                    //handleDisbDateChange(date, index, setFieldValue, validateForm)
                    const formatted = date
                      ? `${date.getDate().toString().padStart(2, '0')}-${(
                        date.getMonth() + 1
                      )
                        .toString()
                        .padStart(2, '0')}-${date.getFullYear()}`
                      : '';
                    console.log('formatted', formatted);
                    // setFieldValue(`data.${index}.disbDt`, [formatted]);
                    // validate only conditional fields for this row
                    validateField(`data.${index}.sancDt`);
                    validateField(`data.${index}.undrawnSanc`);
                    validateField(`data.${index}.outstandingAmt`);
                    validateField(`data.${index}.totalExposure`);
                    validateField(`data.${index}.intRate`);
                    validateField(`data.${index}.tenure`);
                    validateField(`data.${index}.contactDetails`);
                    validateField(`data.${index}.security`);
                    validateField(`data.${index}.corpGuarantee`);
                    validateField(`data.${index}.persGuarantee`);
                    validateField(`data.${index}.collSecurity`);
                    validateField(`data.${index}.majorCovenants`);

                  }
                  }
                />
              </>
            )}

            {colIndex === 7 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.disbAmt`}
                type="number"
                onCustomChange={(value: any) => {
                  handleFieldChange(index, 'disbAmt', value, setFieldValue, values);
                  const sancAmt = values.data[index].sancAmt || 0;
                  setFieldValue(`data.${index}.undrawnSanc`, sancAmt - value);
                }}
              />
            )}
            {colIndex === 8 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.undrawnSanc`}
                disabled={true}
                type="number"
              />
            )}
            {colIndex === 9 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.outstandingAmt`}
                type="number"
                onCustomChange={(value: any) => handleFieldChange(index, 'outstandingAmt', value, setFieldValue, values)}
              />
            )}
            {colIndex === 10 && (
              <AdvanceTextBoxField
                label=""
                name={`data.${index}.totalExposure`}
                type="number"
                disabled={true}
              />
            )}
            {colIndex === 11 && (
              <TextBoxField
                label=""
                name={`data.${index}.intRate`}
                type="number"
              />
            )}
            {colIndex === 12 && (
              <TextBoxField
                label=""
                name={`data.${index}.tenure`}
                type="number"
              />
            )}
            {colIndex === 13 && (
              <TextBoxField
                label=""
                name={`data.${index}.contactDetails`}
              />
            )}
            {colIndex === 14 && (
              <TextBoxField
                label=""
                name={`data.${index}.acr`}
                type="number"
              />
            )}
            {colIndex === 15 && (
              <TextBoxField
                label=""
                name={`data.${index}.security`}
              />
            )}
            {colIndex === 16 && (
              <TextBoxField
                label=""
                name={`data.${index}.corpGuarantee`}
              />
            )}
            {colIndex === 17 && (
              <TextBoxField
                label=""
                name={`data.${index}.persGuarantee`}
              />
            )}
            {colIndex === 18 && (
              <TextBoxField
                label=""
                name={`data.${index}.collSecurity`}
              />
            )}
            {colIndex === 19 && (
              <TextBoxField
                label=""
                name={`data.${index}.majorCovenants`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const [updateCommentByNId] = useUpdateCommentByNIdMutation();
  const [getOpenSectionsData, setOpenSections] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(false);
  const [getNotiId, setNotiId] = useState<any>('');
  const { opensections } = useAppSelector((state: any) => state.userStore);
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

  if (isLoading || isProcessing) return <FormLoader />;
  if (isUploading) return <FullScreenLoaderNoClose />;

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
              (item: any) => item?.sectionId === "09" && item?.subSectionId === "02"
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
              {snackMessages.map((msg, i) => (
                <li key={i} className="text-danger">{`(${i + 1}) ${msg}`}</li>
              ))}
            </ul>
          </Alert>
        </Snackbar>

        <ConfirmationAlertDialog
          id={1}
          type={4}
          open={openConfirmation}
          handleClose={handleCloseConfirmation}
          handleDelete={handleSubmitConfirmation}
          values={formData}
        />
        <div className="custome-form">
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
              validationSchema={termLoanListingSchema(appDetails?.submitDate)}
              // context={{ appSubmitDt: appDetails?.submitDate }}
              validateOnChange={true}
              validateOnBlur={true}
            >
              {({ values, errors, setFieldValue, validateForm, validateField }) => {


                const sanTotal = useMemo(() => calculateSanTotal(values), [values]);
                const disbTotal = useMemo(() => calculateDisbTotal(values), [values]);
                const undrawnTotal = useMemo(() => calculateUndrawnSanctionTotal(values), [values]);
                const outStTotal = useMemo(() => calculateOutStTotal(values), [values]);
                const expoTotal = useMemo(() => calculateExpoTotal(values), [values]);
                const itemCount = values.data.length;
                const ITEM_SIZE = 50;
                const MAX_HEIGHT = 500; // You can adjust this based on your layout
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
                                    applId,
                                    slNo: values.data.length,
                                    lenderName: '',
                                    lenderType: null,
                                    sancDt: null,
                                    sancAmt: null,
                                    disbDt: null,
                                    disbAmt: null,
                                    undrawnSanc: null,
                                    outstandingAmt: null,
                                    totalExposure: null,
                                    intRate: null,
                                    tenure: null,
                                    contactDetails: null,
                                    acr: null,
                                    security: '',
                                    corpGuarantee: '',
                                    persGuarantee: '',
                                    collSecurity: '',
                                    majorCovenants: '',
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
                                    {i === 2 && <b>Name of the Bank/ lender</b>}
                                    {i === 3 && <b>Institution Type</b>}
                                    {i === 4 && <b>Date of Sanction</b>}
                                    {i === 5 && <b>Sanctioned Amount (In ₹ crore)</b>}
                                    {i === 6 && <b>Date of Disbursement</b>}
                                    {i === 7 && <b>Amount Disbursement (In ₹ crore)</b>}
                                    {i === 8 && <b>Undrawn Sanction</b>}
                                    {i === 9 && <b>Amount Outstanding (In ₹ crore)</b>}
                                    {i === 10 && <b>Total Exposure</b>}
                                    {i === 11 && <b>Interest rate (%)</b>}
                                    {i === 12 && <b>Tenure(in months)</b>}
                                    {i === 13 && <b>Contact Details of Lenders</b>}
                                    {i === 14 && <b>ACR</b>}
                                    {i === 15 && <b>Security</b>}
                                    {i === 16 && <b>Any Corporate Guarantee given for others</b>}
                                    {i === 17 && <b>Any personal guarantee of promoters / founders / directors given to others</b>}
                                    {i === 18 && <b>Any collateral security provided to any lender</b>}
                                    {i === 19 && <b>Major Covenants</b>}
                                  </div>
                                ))}
                              </div>
                              {values.data.length > 0 ? <div style={{ flex: 1 }}>
                                <FixedSizeList
                                  className="table-list-container"
                                  //height={300}
                                  height={calculatedHeight}
                                  itemCount={values.data.length}
                                  itemSize={ITEM_SIZE}
                                  width="100%"
                                  itemData={{ values, setFieldValue, validateForm, validateField }}
                                >
                                  {renderRow}
                                </FixedSizeList> </div> : ''}

                              <div style={{ display: 'flex' }} className="div-table-row">
                                <div style={{ width: `${columnWidths[0]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[1]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[2]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[3]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[4]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell"><b>Total</b></div>
                                <div style={{ width: `${columnWidths[5]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{sanTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths[6]}px`, flexShrink: 0 }} className="div-table-cell"></div>
                                <div style={{ width: `${columnWidths[7]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{disbTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths[8]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{undrawnTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths[9]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{outStTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths[10]}px`, padding: '8px', flexShrink: 0 }} className="div-table-cell">
                                  <b>{expoTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, style: 'currency', currency: 'INR' })}</b>
                                </div>
                                <div style={{ width: `${columnWidths.slice(11).reduce((a, b) => a + b, 0)}px`, flexShrink: 0 }} className="div-table-cell"></div>
                              </div>
                            </div>
                          </>
                        )}
                      </FieldArray>
                    </fieldset>
                    {values?.data?.[0]?.saveStatus !== "02" && (
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
                    )}
                  </Form>
                );
              }}
            </Formik>
          </div>
          <OnlineSnackbar open={openSnackbar} msg={snackMsg} severity={severity} handleSnackClose={handleClosePop} />
        </div>
      </div>
    </>
  );
};

export default connect((state: any) => ({
  applId: state.userStore.applId
}))(LenderTermLoanForm);


{
    data:[{
            "bankName": "A.T. Invofin India Pvt Ltd",
            "tag": "NBFC/ FI",
            "bankTag": "TL"
        },
        {
            "bankName": "Abans Finance Private Limited",
            "tag": "NBFC/ FI",
            "bankTag": "TL"
        },
        {
            "bankName": "Abhinandan Investments Limited (Name as per MCA - Abhinandan Tradex Limited)",
            "tag": "NBFC/ FI",
            "bankTag": "LIMIT"
        },
    ]
    "message": "Success",
    "status": 200
}

      import React, { useMemo } from "react";
import { KeyValuePair } from "../../../components/framework/KeyValuePair";
import { getIn, useFormikContext } from "formik";
import Typography from "@mui/material/Typography";
import { Autocomplete, TextField, Grid } from "@mui/material";
import { useGetMaterQuery } from "../../../features/master/api";
import { modify } from "../../../utlis/helpers";
import { useGetMirQuery } from "../../../features/mir/api";
import SelectLoader from "../../../loader/SelectLoader";

export const MultipleLenderDropDown = (props: {
  label?: string;
  name: string;
  domain: string;
  disabled?: boolean;
  options?: any[];
  isLoading?: boolean;
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
    isLoading: isMasterLoadingInternal,
    error: masterError,
  } = props.options ?
      { data: props.options, isLoading: false, error: null } :
      useGetMaterQuery(`refapi/${props.domain}`, {
        refetchOnMountOrArgChange: true
      });

  const options = useMemo(() => {
    if (props.options) return props.options;

    return modify(props.domain, masterData)?.map((item: any) => ({
      key: item.key,
      value: props.domain !== "mir/getMirPnfList" ? item.value : item.key,
      label: item.label || item.value
    })) || [];
  }, [masterData, props.domain, props.options]);

  const currentValue = useMemo(() => {
    return options.find(
      (option: any) => option.value == getIn(values, props.name)
    ) || null;
  }, [options, values, props.name]);

  const isLoading = props.isLoading !== undefined ?
    props.isLoading :
    isMasterLoadingInternal;

  if (isLoading) return <SelectLoader />;

  return (
    <Grid item xs={12}>
      <Autocomplete
        sx={{
          "& .MuiOutlinedInput-root": {
            paddingRight: "20px!important",
            paddingLeft: "0px!important",
            paddingTop: "0px!important",
            paddingBottom: "0px!important",
          },
        }}
        fullWidth
        options={options}
        value={currentValue}
        disabled={props?.disabled}
        loading={isLoading}
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
            sx={{
              padding: 0
            }}
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


import { STATUS } from "./constants";
// Helper function
export function showFileFromByteArray(byteArray: string, mimeType: string) {
  const byteCharacters = atob(byteArray);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray1 = new Uint8Array(byteNumbers);
  const file = new Blob([byteArray1], { type: mimeType });
  const fileURL = URL.createObjectURL(file);
  window.open(fileURL);
}


export const getTime = (): number => {
  return new Date().getTime();
};

export const modify = (domain: string, masterData: any) => {
  let master: any = [];
  switch (domain) {
    case "mstr/businessNature":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.natCd,
          value: item.natDesc,
        }));

      return master;
    case "mstr/getKmpType": master =
      masterData &&
      masterData.map((item: any) => ({
        key: item.slNo,
        value: item.particulars,
      }));

      return master;

    case "mstr/getNbfcMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.nbfcCifCd,
          value: `${item.nbfcName}-${item.nbfcCifCd}-${item.nbfcId}-${item.nbfcPanNo}`,
          label: item.nbfcName,
        }));
      return master;

    case "mstr/loanPurpose":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.purCd,
          value: item.purDesc,
        }));
      return master;
    case "mir/getMirPnfList":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.mirId,
          value: `${item.customerDetails}-${item.mirValidTo}-${item.mirRefNO}-${item.cifCd}`,
          label: `${item.customerDetails}-${item.mirValidTo}`,
        }));
      return master;

    case "mstr/getScheme":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.schCd,
          value: `${item.schLongName}`,
        }));
      return master;

    case "mstr/getCovenantMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.covenant}`,
          label: `${item.covenant}`,
        }));
      return master;

    case "mstr/getApprlCoventOpertr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.operator}`,
          label: `${item.operator}`,
        }));
      return master;

    case "mstr/getBenchMark":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.BRM_RATE_ID,
          value: `${item.BRM_RATE_ID}`,
          label: `${item.BRM_RATE_NAME}`
        }));
      return master;

    case "committee/getAllCommitteeMasters":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.commId,
          value: `${item.commId}`,
          label: `${item.commName}`,
        }));

      return master;

    case "committee/getAllMemberRoles":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.roleId,
          value: `${item.roleName}`,
        }));

      return master;

    case "minutes/getAllUsers":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.userId,
          value: `${item.userName}-${item.userEmpId}-${item.userDesgn}`,
          label: `${item.userName}`,
        }));

      return master;


    case "mstr/getFundMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.fundCode,
          value: `${item.fundDesc}`,
        }));
      return master;

    case "mstr/getStockExchange":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.exchangeType,
          label: item?.exchangeType,
        }));
      return master;

    case "mstr/getRatingAgency":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.agencyDet,
          value: `${item.agencyDet}`,
          label: item.agencyDet
        }));
      return master;

    case "mstr/getRatingCode":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.ratingDet,
          value: `${item.ratingDet}`,
          label: item.ratingDet
        }));
      return master;

    case "mstr/getAppraGradingCovent":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.gradingValue}`,
          label: `${item.gradingValue}`,
        }));
      return master;

    case "committee/getLosAgendaPurpose":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.prpsCd,
          value: `${item.prpsDesc}`,
        }));
      return master;

    case "minutes/getAgendaStatusMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.statusCd,
          value: `${item.statusDesc}`,
        }));
      return master;


    case "minutes/getNBFCApprovedUsersData":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.applId,
          value: `${item.nbfcName}`,
        }));
      return master;

    case "appl/getProdMstr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.prodId,
          value: item.prodId,
          label: item?.prodDesc,
        }));
      return master;

    case "appl/getProdSchemeMstr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.schCd,
          value: item.schCd,
          label: item?.schLongName,
        }));
      return master;

    case "appl/getProdAssistType":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.assistType,
          value: item.assistType,
          label: item?.assistType,
        }));
      return master;



    case `dueDiligence/parentOrHolding`:
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.ddId,
          value: item.ddId,
          label: item?.entityName,
        }));
      return master;

    case "mstr/getConstitution":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item.id,
          label: item?.name,
        }));
      return master;

    case "mstr/getclassification":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.classCd,
          value: item.classCd,
          label: item?.classDesc,
        }));
      return master;

    case "mstr/getLenderType":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.particulars,
          label: item?.particulars,
        }));
      return master;

    case "mstr/getBorrowParticulars":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.particulars,
          label: item?.particulars,
        }));
      return master;


    case "mstr/getIndividualParticular":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.particulars,
          label: item?.particulars,
        }));
      return master;

    case "mstr/getBankMasters":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item.bankName,
          label: item?.bankName,
        }));
      return master;

    case "mstr/getStateMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.stateCode,
          value: item.stateName,
          label: item?.stateName,
        }));
      return master;

    case "mstr/getKmpDesignation":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.slNo,
          value: item.desgnDesc,
          label: item?.desgnDesc,
        }));
      return master;

    case "mstr/getPortfolioTrnxMaster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item.constTypes,
          label: item?.constTypes,
        }));
      return master;

    case "mstr/getNbfcLayerTypes":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.nbfcLayerId,
          value: item.nbfcLayerId,
          label: item?.nbfcLayerName,
        }));
      return master;

    case "mstr/getNbfcTypes":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.nbfcTypeId,
          value: item?.nbfcTypeId,
          label: item?.nbfcTypeName,
        }));
      return master;

    case "mstr/getAuditedYears":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item?.year,
          label: item?.year,
        }));
      return master;

    case "mstr/getYearMaster":
      master = masterData?.map((item: any) => ({
        key: item?.slNo,
        value: item.periodName,
        label: item?.periodName,
      }));
      return master;

    case "appl/getIndvShareDetails":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item?.value,
          label: item?.value,
        }));
      return master;

    case "mstr/getUnauditedQuarter":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item?.id,
          value: item?.qtrName,
          label: item?.qtrName,
        }));
      return master;

    case "mstr/getRepayFreq":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.slNo}`,
          label: `${item.particulars}`,
        }));
      return master;

    case "mstr/getProduct":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.prodId,
          value: `${item.prodId}`,
          label: `${item.prodDesc}`,
        }));
      return master;

    case "mstr/getFacilityTypeMstr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.slNo}`,
          label: `${item.facilityType}`,
        }));
      return master;

    case "mstr/getResetClauseMstr":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.slNo}`,
          label: item.resetClauseDesc
        }));
      return master;

    case "mstr/getPastAsationMster":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.id,
          value: `${item.id}`,
          label: item.particulars
        }));
      return master;

    case "mstr/getProdCutType":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.id,
          value: `${item.id}`,
          label: item.product
        }));
      return master;

    case "mstr/getLimitType":
      master =
        masterData &&
        masterData.map((item: any) => ({
          key: item.slNo,
          value: `${item.particulars}`,
          label: item.particulars,
          lenderType:item.lenderType,
        }));
      return master;

    default:
  }
};

export const statusCode: any = (status: any) => {
  return STATUS[status];
};

export const getStatusCodeValue: any = (value: any) => {
  const object = STATUS;
  return Object.keys(object).find((key) => object[key] === value);
};

// Defined the function to check if string is checkSplittable 
export const checkSplittable = (inputString: string) => {
  return inputString.length % 4 !== 0 ? false : (() => {
    const regex = new RegExp(`.{${inputString.length / 4}}`, 'g');
    const segments = inputString.match(regex);
    return segments && new Set(segments).size === 4;
  })();
};
//End checkSplittable 


i want in LenderLimitOdForm remove Type of FI field but on select of bank tag will save for that field and in LenderTermLoanForm insitution type field also remove from ui but in save api it will go on select of bank and one more thing bankTag if TL then those value will not come in LenderTermLoanForm for bank and LenderLimitOdForm all value will come give me complete and proper code 
