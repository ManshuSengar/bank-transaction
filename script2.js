import Grid from "@mui/material/Grid";
import { useGetConfigQuery, useGetLeadQuery, useUpdateLeadMutation } from "../../slices/leadSlice";
import EntityForm from "../../Components/Framework/EntityForm";
import { TextBoxField } from "../../Components/Framework/TextBoxField";
import { useState, useEffect } from "react";
import Typography from "@mui/material/Typography";
import { ErrorMessage } from "../../Components/Framework/ErrorMessage";
import LinearProgress from "@material-ui/core/LinearProgress";
import * as Yup from "yup";
import {
  FormSubmit,
  SubmitableForm,
} from "../../Components/Framework/FormSubmit";
import { DatePickerField } from "../../Components/Framework/DatePickerField";
import React from "react";
import { useAppSelector } from "../../app/hooks";
import {
  defaultLoanDetails,
  loanDetailsSchema,
} from "../../models/loanDetails";
import {
  defaultNbfcLoanDetails,
  nbfcLoanDetailsSchema,
} from "../../models/nbfcLoanDetails";
import Section from "../../Components/Framework/Section";
// import { DropDownField } from "../../Components/Framework/DropDownField";
import { TextBoxFieldAmountStartAdornment } from "../../Components/Framework/TextBoxFieldAmountStartAdornment";
import { TextBoxFieldAmountStartAdornmentWithDecimal } from "../../Components/Framework/TextBoxFieldAmountStartAdornmentWithDecimal";
import { TextBoxFieldPercentageEndAdornment } from "../../Components/Framework/TextBoxFieldPercentageEndAdornment";
import { AutocompleteField } from "../../Components/Framework/AutocompleteField";
import { DropDownFieldYesNo } from "../../Components/Framework/DropDownFieldYesNo";
import { TextField } from "@material-ui/core";
import { DisplayOnlyTextField } from "../../Components/Framework/DisplayOnlyTextField";
import { SidbiDisbursementDate, SidbiLoanAmount, SidbiShare } from "./SidbiLoanAsk";
import { skipToken } from "@reduxjs/toolkit/dist/query";
import { sidbiShareSchema } from "../../models/sidbiShare";
import SaveColorButton from "../../Components/Framework/ColorButton";

const formatNonDigitCharacter = (num: string): string => {
  if (num == null) return ""; // handle undefined or null safely
  const str = String(num); // ensure it's a string
  // Allow digits and a single decimal point
  let formattedNum = str.replace(/[^0-9.]/g, "");
 
  // Ensure there's only one decimal point
  const parts = formattedNum.split(".");
  if (parts.length > 2) {
    formattedNum = `${parts[0]}.${parts[1]}`;
  }
 
  // Cap the value if it exceeds 100, but only after a full number is entered
  if (parseFloat(formattedNum) > 100) {
    return "100";
  }
 
  // Limit the decimal part to two digits
  if (parts[1]) {
    formattedNum = `${parts[0]}.${parts[1].substring(0, 2)}`;
  }
 
  return formattedNum;
};

const LoanDetails = React.forwardRef<SubmitableForm, {}>((props, ref) => {
  const { id: leadId } = useAppSelector((state) => state.leadStore);
    
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const { data } = useGetLeadQuery(Number(leadId) || skipToken)
  const [isProjectLoanYes, setIsProjectLoanYes] = useState(false);
 
  const handleProjectLoanChange = (event: any) => {
    setIsProjectLoanYes(event.target.value === "y"); // Check if 'Yes' is selected
  };

  const {data : config} = useGetConfigQuery(Number(leadId) || skipToken);

  const [nbfcRoi, setNbfcRoi] = useState<number | null>(null);
  const [sidbiRoiToCustomer, setSidbiRoiToCustomer] = useState<number | null>(null);
  const [effectiveRate, setEffectiveRate] = useState<number | null>(null);

  const calculateEffectiveInterestRateToCustomer = (nbfcRoi : number, sidbiRoiToCustomer : number) => {
    if(config?.sidbiShare && nbfcRoi && sidbiRoiToCustomer) {
      let nbfcShare = 1 - config.sidbiShare;
      let effectiveRateCalc = nbfcRoi * nbfcShare + sidbiRoiToCustomer * config.sidbiShare;
      const formattedEffectiveRateCalc = parseFloat(formatNonDigitCharacter(String(effectiveRateCalc))) || 0;
      setEffectiveRate(formattedEffectiveRateCalc);
    }
  }

  // ✅ On page load, populate fields from API and calculate
  useEffect(() => {
    if (data && config) {
      const nbfc = data?.nbfcLoanDetails?.nbfcRoi ?? 0;
      const sidbi = data?.loanDetails?.sidbiRate ?? 0;
   
      const formattedNbfc = parseFloat(formatNonDigitCharacter(String(nbfc))) || 0;
      const formattedSidbi = parseFloat(formatNonDigitCharacter(String(sidbi))) || 0;
   
      setNbfcRoi(formattedNbfc);
      setSidbiRoiToCustomer(formattedSidbi);
   
      calculateEffectiveInterestRateToCustomer(formattedNbfc, formattedSidbi);
    }
  }, [data, config]);

  // ✅ Handle NBFC ROI change
  const handleNbfcRoiChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value) || 0;
        setNbfcRoi(value);
        if (sidbiRoiToCustomer !== null)
          calculateEffectiveInterestRateToCustomer(value, sidbiRoiToCustomer);
      };

  return leadId ? (
    <EntityForm
      id={leadId || 0}
      defaultItem={{
        loanDetails: defaultLoanDetails,
        nbfcLoanDetails: defaultNbfcLoanDetails,
      }}
      itemSchema={Yup.object().shape({
        loanDetails: loanDetailsSchema,
        nbfcLoanDetails: nbfcLoanDetailsSchema,
      })}
      useUpdateItemMutation={useUpdateLeadMutation}
      useGetItemQuery={useGetLeadQuery}
      setError={setError}
      setIsLoading={setIsLoading}
    >
      <Grid
        container
        style={{
          backgroundColor: error && "#FFD1DC",
          paddingBottom: 0,
          paddingLeft: "16px",
          paddingRight: "8px",
        }}
        spacing={2}
      >
        <Grid item xs={12} lg={12}>
          {isLoading && <LinearProgress color="secondary" />}
        </Grid>

        <Section>
          <Grid container spacing={2} padding={4}>
            <Grid item xs={12} lg={12}>
              <Typography
                variant="h6"
                gutterBottom
                style={{ marginBottom: "0px", fontWeight: "600" }}
              >
                NBFC Loan Details
              </Typography>
            </Grid>
            <Grid item xs={12} lg={12}>
              <ErrorMessage status={error} />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxFieldAmountStartAdornmentWithDecimal
                label={
                  <>
                    Customer Applied Amount<span style={{ color: 'red' }}> *</span>
                  </>
                }
                name={"nbfcLoanDetails.nbfcLoanAmount"}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
                <DatePickerField
                  label={
                    <>
                    Customer Application Date
                    </>
                  }
                  name="nbfcLoanDetails.nbfcDisbursalDate"
                  allowPast={true}
                />
              </Grid>
              <Grid item xs={12} lg={4}>
              <TextBoxField
                label={
                  <>
                    Requested Tenure (Months)<span style={{ color: 'red' }}> *</span>
                  </>
                }
                name="nbfcLoanDetails.nbfcTenure"
                type="number"
                maxLength={3}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxFieldAmountStartAdornmentWithDecimal
                label={
                  <>
                    NBFC assessed amount (in Rs)<span style={{ color: 'red' }}> *</span>
                  </>
                }
                name={"nbfcLoanDetails.outstandingAmount"}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <DatePickerField
                label={
                  <>
                  NBFC Sanction Date
                  </>
                }
                name="nbfcLoanDetails.nbfcSanctionDate"
                allowPast={true}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxField
                label={
                  <>
                    NBFC assessed Tenure (months)
                    <span
                      style={{ color: "red" }}
                    >
                      {" "}
                      *
                    </span>
                  </>
                }
                name="nbfcLoanDetails.balanceTenure"
                type="number"
                maxLength={3}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <AutocompleteField
                label={"Purpose"}
                name={"nbfcLoanDetails.purpose"}
                domain={"m_purpose_of_loan"}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              {/* <DropDownFieldYesNo
                label="CGTMSE"
                name={"nbfcLoanDetails.cgtmse"}
              /> */}
              <AutocompleteField
                label={
                  <>
                    CGTMSE<span style={{ color: 'red' }}> *</span>
                  </>
                }
                name={"nbfcLoanDetails.cgtmse"}
                domain={"m_cgstme"}
              />
            </Grid>
            {data?.productName === 'secured' && (
              <>
                <Grid item xs={12} lg={4}>
                  <DropDownFieldYesNo
                    label={
                      <>
                        Project Loan
                      </>
                    }
                    name={"nbfcLoanDetails.projectloan"}
                    onChange={handleProjectLoanChange}
                    // onChange={(event: any) => {
                    //   console.log(event.target.value);
                    //   setIsProjectLoanYes(event.target.value === 'Yes');
                    // }}
                  />
                </Grid>
                {isProjectLoanYes && (
                  <Grid item xs={12} lg={4}>
                    <DatePickerField label="DCCO" name={"nbfcLoanDetails.dcco"} />
                  </Grid>
                )}
              </>
            )}
          </Grid>
          {isLoading && (
            <Grid container spacing={0} padding={0}>
              <Grid item xs={12} lg={12}>
                <LinearProgress color="secondary" />
              </Grid>
            </Grid>
          )}
        </Section>

        <Section sx={{ marginTop: "24px", width: '100%' }}>
          {isLoading && (
            <Grid container spacing={0} padding={0}>
              <Grid item xs={12} lg={12}>
                <LinearProgress color="secondary" />
              </Grid>
            </Grid>
          )}
          <Grid container spacing={2} padding={4}>
            <Grid item xs={12} lg={12}>
              <Typography
                variant="h6"
                gutterBottom
                style={{ marginBottom: "0px", fontWeight: "600" }}
              >
                Loan Ask
              </Typography>
            </Grid>
            <Grid item xs={12} lg={12}>
              <ErrorMessage status={error} />
            </Grid>
            <Grid item xs={12} lg={4}>
              <SidbiShare/>
            </Grid>
            <Grid item xs={12} lg={4}>
              <SidbiLoanAmount/>
            </Grid>
          </Grid>
        </Section>
        <Section sx={{ marginTop: "24px", width: '100%' }}>
          {isLoading && (
            <Grid container spacing={0} padding={0}>
              <Grid item xs={12} lg={12}>
                <LinearProgress color="secondary" />
              </Grid>
            </Grid>
          )}
          <Grid container spacing={2} padding={4}>
            <Grid item xs={12} lg={12}>
              <Typography
                variant="h6"
                gutterBottom
                style={{ marginBottom: "0px", fontWeight: "600" }}
              >
                Interest Fixation
              </Typography>
            </Grid>
            <Grid item xs={12} lg={12}>
              <ErrorMessage status={error} />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxFieldPercentageEndAdornment
                label={
                  <>
                  NBFC ROI<span style={{ color: 'red' }}> *</span>
                  </>
                }
                name={"nbfcLoanDetails.nbfcRoi"}
                onChange={handleNbfcRoiChange}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxFieldPercentageEndAdornment
                label={
                  <>
                  Rate Negotiated With Customer
                  </>
                }
                name={"nbfcLoanDetails.rateNegotiatedWithCustomer"}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <DatePickerField
                label={
                  <>Next Full EMI Date</>
                }
                name={"nbfcLoanDetails.nextFullEmiDate"}
                allowFuture={true}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <AutocompleteField
                label={
                  <>
                    SIDBI’s Hurdle Rate Type
                    <span
                      style={{ color: "red" }}
                    >
                      {" "}
                      *
                    </span>
                  </>
                }
                name={"loanDetails.rateType"}
                domain={"m_base_rate_type"}
                disabled
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <AutocompleteField
                label={
                  <>
                    SIDBI’s Hurdle Rate
                    <span
                      style={{ color: "red" }}
                    >
                      {" "}
                      *
                    </span>
                  </>
                }
                name={"loanDetails.benchMarkRate"}
                domain={"m_interest_rate"}
                disabled
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxFieldPercentageEndAdornment
                label={
                  <>
                  Additional spread<span style={{ color: 'red' }}> *</span>
                  </>
                }
                name={"loanDetails.additionalSpread"}
                disabled
                css={"#F8F8F8"}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxFieldPercentageEndAdornment
                label={
                  <>
                  Maximum Service rate fee<span style={{ color: 'red' }}> *</span>
                  </>
                }
                name={"loanDetails.maxServiceRateFee"}
                disabled
                css={"#F8F8F8"}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxFieldPercentageEndAdornment
                label={
                  <>
                    SIDBI ROI to customer
                    <span
                      style={{ color: "red" }}
                    >
                      {" "}
                      *
                    </span>
                  </>
                }
                name={"loanDetails.sidbiRate"}
                disabled
                css={"#F8F8F8"}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <TextBoxFieldPercentageEndAdornment
                label={
                  <>
                    Effective interest rate to end customer
                    <span
                      style={{ color: "red" }}
                    >
                      {" "}
                      *
                    </span>
                  </>
                }
                name={"loanDetails.effectiveInterestRateToCustomer"}
                valueChanged={effectiveRate}
                disabled
                css={"#F8F8F8"}
              />
            </Grid>            
          </Grid>
        </Section>
      </Grid>
      <FormSubmit ref={ref} />
    </EntityForm>
  ) : (
    <>Loading...</>
  );
});

export default LoanDetails;

import { BaseDTO } from "./baseModels";
import * as Yup from "yup";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
 
dayjs.extend(customParseFormat);

//Data model
export interface NbfcLoanDetails extends BaseDTO {
  nbfcLoanAmount?: number;
  nbfcRoi?: number;
  nbfcTenure?: number;
  nbfcDisbursalDate?: Date;
  outstandingAmount?: number;
  emiAmount?: string;
  balanceTenure?: number;
  nextFullEmiDate?: Date;
  purpose?: string;
  cgtmse?: string;
  projectloan?: string;
  dcco?: Date;
  rateType?: string;
  benchmark?: string;
  nbfcEmiStartDate?: Date;
  previousEmidate?: Date;
  sidbiRoiToCustomer?: number;
  bankRoi?: number;
  baseRateType?: string;
  baseRate?: number;
  emiMoratorium?: number;
  principleMoratorium?: number;
  advanceEmi?: string;
  processingFee?: string;
  netDisbursalAmount?: string;
  rateNegotiatedWithCustomer?: number;
  nbfcSanctionDate?: Date;
}

//Validation Schema for the model
export const nbfcLoanDetailsSchema = Yup.object().shape({
  nbfcLoanAmount: Yup.number()
    .typeError("Please enter a valid number")
    .required("Please enter a valid number"),
  nbfcRoi: Yup.number()
    .typeError("Please enter a valid number")
    .required("Please enter a valid number"),
  nbfcTenure: Yup.number()
    .typeError("Please enter a valid number")
    .required("Please enter a valid number"),
  nbfcDisbursalDate: Yup.string()
    .nullable()  // This allows null values (so the field can be empty).
    .notRequired()  // Makes it optional, so validation is not triggered if the field is empty.
    .test(
      'valid-date',
      'Please enter a valid date in DD/MM/YYYY format',
      (value) => {
        if (value) {
          const parsedDate = dayjs(value);
          if (parsedDate.isValid()) {
            value = parsedDate.format('YYYY-MM-DD'); // Extract only the date
          }
          // Check if the date is valid in the required format
          return dayjs(value, 'YYYY-MM-DD', true).isValid();
        }
        return true; // Return true if the field is empty, so validation passes
      }
    )
    .test(
      'not-future-date',
      'Date cannot be in the future',
      (value) => {
        if (value) {
          // Ensure the date is not in the past or in the future
          return !(dayjs(value).isSame(dayjs(), 'day') || dayjs(value).isAfter(dayjs(), 'day'));
        }
        return true; // Return true if the field is empty, so validation passes
      }
    )
    ,
  outstandingAmount: Yup.number()
    .typeError("Please enter a valid number")
    .required("Please enter a valid number"),
  balanceTenure: Yup.number()
    .typeError("Please enter a valid number")
    .required("Please enter a valid number")
    .test(
      'is-less-than-or-equal-to-nbfcTenure',
      'Balance Tenure should not be greater than Total Tenure (In Months) of the Loan',
      function (value) {
        const { nbfcTenure } = this.parent; // Access `nbfcTenure` from the parent object
        return value !== undefined && value <= nbfcTenure; // Ensure `value` is defined and validate
      }
    ),
  // nextFullEmiDate: Yup.string()
  //   .required("Please enter a valid date")
  //   .test(
  //     'valid-date',
  //     'Please enter a valid date in DD/MM/YYYY format',
  //     (value) => {
  //       if (value) {
  //         const parsedDate = dayjs(value);
  //         if (parsedDate.isValid()) {
  //           value = parsedDate.format('YYYY-MM-DD'); // Extract only the date
  //         }
  //         // Check if the date is valid in the required format
  //         return dayjs(value, 'YYYY-MM-DD', true).isValid();
  //       }
  //       return true; // Return true if the field is empty, so validation passes
  //     }
  //   )
  //   .test(
  //     'not-past-date',
  //     'Date cannot be in the past',
  //     (value) => {
  //       // // Ensure the date is not in the past (compare against today's date)
  //       return !(dayjs(value).isSame(dayjs(), 'day') || dayjs(value).isBefore(dayjs(), 'day')); //For 
  //     }
  //   )
  //   ,
  purpose: Yup.string()
    .typeError("Please select from the drop down"),
  cgtmse: Yup.string()
    .required("Please select a value from drop-down list"),
  projectloan: Yup.string()
    .required("Please select a value from drop-down list"),
  // sidbiHurdleRate: Yup.string()
  //   .required("Please select a value from drop-down list"),
  nbfcSanctionDate: Yup.string()
  .nullable()
  .notRequired()
  .transform((value) => {
    if (!value) return value;
    const d = dayjs(value, "DD/MM/YYYY", true);
    return d.isValid() ? d.format("YYYY-MM-DD") : value; // stored as YYYY-MM-DD
  })
  .test(
    "valid-date",
    "Please enter a valid date in DD/MM/YYYY format",
    (value) => {
      if (!value) return true;
      return dayjs(value, ["YYYY-MM-DD", "DD/MM/YYYY"], true).isValid();
    }
  )
  .test(
    "sanction-after-disbursal",
    "NBFC Sanction Date must be greater than or equal to Customer Application Date",
    function (value) {
      if (!value) return true;
      const { nbfcDisbursalDate } = this.parent;
      if (!nbfcDisbursalDate) return true;
 
      const sanction = dayjs(value, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
      const disbursal = dayjs(nbfcDisbursalDate, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
 
      if (!sanction.isValid() || !disbursal.isValid()) return true;
 
      return (
        sanction.isSame(disbursal, "day") ||
        sanction.isAfter(disbursal, "day")
      );
    }
  )
});

//Default values
export const defaultNbfcLoanDetails = {
  nbfcLoanAmount: undefined,
  nbfcRoi: undefined,
  rateNegotiatedWithCustomer: undefined,
  nbfcTenure: undefined,
  nbfcDisbursalDate: undefined,
  outstandingAmount: undefined,
  additionalSpread: undefined,
  emiAmount: undefined,
  balanceTenure: undefined,
  nextFullEmiDate: undefined,
  purpose: undefined,
  cgtmse: undefined,
  projectloan: undefined,
  dcco: undefined,
  nbfcSanctionDate: undefined,
};


Loan Details	Retain as is – only change – remove project loan field	
Loan Details	The following fields in Interest fixation are removed
Rate negotiated with customer 
Next Full EMI date
Additional spread		

these are changes which i have to do in these form and give me complete and proper code 
