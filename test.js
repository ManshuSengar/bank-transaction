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
