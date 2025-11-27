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
  useDeleteKmpBureauMutation,
  useLazyListKmpBureausQuery
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

  const [listKmpDocsQuery] = useLazyListKmpDocumentsQuery();
  const [listKmpBureausQuery] = useLazyListKmpBureausQuery();

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

    // Validate KYC Documents (at least 2 required)
    if(kmpKycDocuments?.content === undefined || 
      kmpKycDocuments?.content.length < 2) {
      setValidationMessage("Individual should have atleast 2 KYC Documents");
      console.log("Returning false from validateKmp", kmpId);
      return false;
    }

    if(kmpKycDocuments && kmpKycDocuments.content !== undefined &&
      kmpKycDocuments.content.length > 0) {
        console.log(kmpKycDocuments.content.length);
      
      // PAN or Form 60 validation
      let panDocList = kmpKycDocuments?.content.filter(item => item.type === "10");
      let form60 = kmpKycDocuments?.content.filter(item => item.type === "21");
      if(panDocList.length <= 0 && form60.length <= 0) {
        setValidationMessage("Please upload PAN copy or Form 60 in KYC Documents section.");
        console.log("Returning false from validateKmp", kmpId);
        return false;
      }

      // Form 60 additional validation
      let voterId = kmpKycDocuments?.content.filter(item => item.type === "4");
      let passport = kmpKycDocuments?.content.filter(item => item.type === "1");
      let driversLicense = kmpKycDocuments?.content.filter(item => item.type === "2");
      let jobCard = kmpKycDocuments?.content.filter(item => item.type === "5");

      if(form60.length > 0) {
        if(voterId.length <= 0 && passport.length <= 0 && driversLicense.length <= 0 && jobCard.length <= 0) {
          setValidationMessage("If FORM 60 is uploaded, then atleast one of voter id / passport / aadhar / driving license / job card should be uploaded.");
          console.log("Returning false from validateKmp", kmpId);
          return false;
        }
      }

      // Photo validation
      let photo = kmpKycDocuments?.content.filter(item => item.type === "8");
      if(photo.length <= 0) {
        setValidationMessage("Photo is mandatory for individuals.");
        console.log("Returning false from validateKmp", kmpId);
        return false;
      }
    }

    // Bureau validation - At least 1 bureau document required
    let kmpBureauDocuments = await listKmpBureausQuery({
      parentId: Number(kmpId) || 0,
      requestValue: {},
    }).unwrap();

    console.log("KMP Bureau Validate: ", kmpId, kmpBureauDocuments);
    
    if(kmpBureauDocuments?.content === undefined || 
      kmpBureauDocuments?.content.length < 1) {
      setValidationMessage("Individual should have at least 1 Bureau Document");
      console.log("Returning false from validateKmp - Bureau missing", kmpId);
      return false;
    }

    // At least one KMP should have PAN
    if(kmpList && kmpList.content != undefined && kmpList.content.length > 0) {
      let kmpWithPan = kmpList?.content.filter(item => item.pan !== undefined && item.pan !== null);
      if(kmpWithPan.length <= 0) {
        setValidationMessage("Atleast PAN for one individual is mandatory.");
        console.log("Returning false from validateKmp", kmpId);
        return false;
      }
    }

    console.log("Returning true from validateKmp", kmpId);

    return true;
  }

  const validateForm = async () => {
    return validateKmp(props.kmpId);
  };

  useImperativeHandle(ref, () => ({       

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
  
    isDirty() {
      if(formToSubmit.current) 
      {
        return formToSubmit.current.isDirty();
      }

      return false;
    },
  
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
  
    getValues() {

      if(formToSubmit.current && formToSubmit.current.getValues) 
      {
        formToSubmit.current.getValues();
      }

      return {};
    }
  
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
                        </>
                      }
                      name="dob"
                      allowPast={true}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxFieldUppercase
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
                          <span style={{ color: "red" }}> *</span>
                        </>
                      }
                      name={"aadhaarNumber"}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <AutocompleteField
                      label={
                        <>
                          Beneficiary Category
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span className="required_symbol" style={{ color: "red" }}> *</span>
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
                          <span className="required_symbol" style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
                        </>
                      }
                      name="contactInformation.address"
                      multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          City
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                        <>Appointment Date
                        </>
                      }
                      name="professionalInformation.appointmentDate"
                      allowPast={true}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <DropDownFieldInlineDomain
                      label={
                        <>
                          KMP Type
                          <span className="required_symbol" style={{ color: "red" }}> *</span>
                        </>
                      }
                      name="professionalInformation.designation"
                      domain={["Financial", "Non financial"]}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          Experience in Years
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
            />

            <Grid
              container
              style={{
                backgroundColor: error && "#FFD1DC",
                paddingBottom: 0,
                paddingLeft: "16px",
                paddingRight: "8px",
              }}
              padding={4}
              spacing={2}
            >
              <DocumentUploadContainer
                parentId={props.kmpId}
                heading={"Bureau"}
                bucket={"kmpBureaus"}
                documentTypeDomain={"m_bureau"}
                useAddMutation={useAddKmpBureauMutation}
                useListQuery={useListKmpBureausQuery}
                useDeleteMutation={useDeleteKmpBureauMutation}
              />
            </Grid>
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
  useDeleteKmpBureauMutation
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

    // Validate KYC Documents (at least 2 required)
    if(kmpKycDocuments?.content === undefined || 
      kmpKycDocuments?.content.length < 2) {
      setValidationMessage("Individual should have atleast 2 KYC Documents");
      console.log("Returning false from validateKmp", kmpId);
      return false;
    }

    if(kmpKycDocuments && kmpKycDocuments.content !== undefined &&
      kmpKycDocuments.content.length > 0) {
        console.log(kmpKycDocuments.content.length);
      
      // PAN or Form 60 validation
      let panDocList = kmpKycDocuments?.content.filter(item => item.type === "10");
      let form60 = kmpKycDocuments?.content.filter(item => item.type === "21");
      if(panDocList.length <= 0 && form60.length <= 0) {
        setValidationMessage("Please upload PAN copy or Form 60 in KYC Documents section.");
        console.log("Returning false from validateKmp", kmpId);
        return false;
      }

      // Form 60 additional validation
      let voterId = kmpKycDocuments?.content.filter(item => item.type === "4");
      let passport = kmpKycDocuments?.content.filter(item => item.type === "1");
      let driversLicense = kmpKycDocuments?.content.filter(item => item.type === "2");
      let jobCard = kmpKycDocuments?.content.filter(item => item.type === "5");

      if(form60.length > 0) {
        if(voterId.length <= 0 && passport.length <= 0 && driversLicense.length <= 0 && jobCard.length <= 0) {
          setValidationMessage("If FORM 60 is uploaded, then atleast one of voter id / passport / aadhar / driving license / job card should be uploaded.");
          console.log("Returning false from validateKmp", kmpId);
          return false;
        }
      }

      // Photo validation
      let photo = kmpKycDocuments?.content.filter(item => item.type === "8");
      if(photo.length <= 0) {
        setValidationMessage("Photo is mandatory for individuals.");
        console.log("Returning false from validateKmp", kmpId);
        return false;
      }
    }

    // Bureau validation - At least 1 bureau document required
    const bureauListInput: RequestWithParentId<SearchRequest<Document>> = {
      parentId: Number(kmpId) || 0,
      requestValue: {},
    };

    try {
      const { data: kmpBureauDocuments } = useListKmpBureausQuery(bureauListInput);
      
      if(kmpBureauDocuments?.content === undefined || 
        kmpBureauDocuments?.content.length < 1) {
        setValidationMessage("Individual should have at least 1 Bureau Document");
        console.log("Returning false from validateKmp - Bureau missing", kmpId);
        return false;
      }
    } catch (error) {
      console.error("Error validating bureau documents:", error);
      setValidationMessage("Error validating Bureau documents for individual");
      return false;
    }

    // At least one KMP should have PAN
    if(kmpList && kmpList.content != undefined && kmpList.content.length > 0) {
      let kmpWithPan = kmpList?.content.filter(item => item.pan !== undefined && item.pan !== null);
      if(kmpWithPan.length <= 0) {
        setValidationMessage("Atleast PAN for one individual is mandatory.");
        console.log("Returning false from validateKmp", kmpId);
        return false;
      }
    }

    console.log("Returning true from validateKmp", kmpId);

    return true;
  }

  const validateForm = async () => {
    return validateKmp(props.kmpId);
  };

  useImperativeHandle(ref, () => ({       

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
  
    isDirty() {
      if(formToSubmit.current) 
      {
        return formToSubmit.current.isDirty();
      }

      return false;
    },
  
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
  
    getValues() {

      if(formToSubmit.current && formToSubmit.current.getValues) 
      {
        formToSubmit.current.getValues();
      }

      return {};
    }
  
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
                        </>
                      }
                      name="dob"
                      allowPast={true}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxFieldUppercase
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
                          <span style={{ color: "red" }}> *</span>
                        </>
                      }
                      name={"aadhaarNumber"}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <AutocompleteField
                      label={
                        <>
                          Beneficiary Category
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span className="required_symbol" style={{ color: "red" }}> *</span>
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
                          <span className="required_symbol" style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
                        </>
                      }
                      name="contactInformation.address"
                      multiline={3}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          City
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                        <>Appointment Date
                        </>
                      }
                      name="professionalInformation.appointmentDate"
                      allowPast={true}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <DropDownFieldInlineDomain
                      label={
                        <>
                          KMP Type
                          <span className="required_symbol" style={{ color: "red" }}> *</span>
                        </>
                      }
                      name="professionalInformation.designation"
                      domain={["Financial", "Non financial"]}
                    />
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <TextBoxField
                      label={
                        <>
                          Experience in Years
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
                          <span style={{ color: "red" }}> *</span>
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
            />

            <Grid
              container
              style={{
                backgroundColor: error && "#FFD1DC",
                paddingBottom: 0,
                paddingLeft: "16px",
                paddingRight: "8px",
              }}
              padding={4}
              spacing={2}
            >
              <DocumentUploadContainer
                parentId={props.kmpId}
                heading={"Bureau"}
                bucket={"kmpBureaus"}
                documentTypeDomain={"m_bureau"}
                useAddMutation={useAddKmpBureauMutation}
                useListQuery={useListKmpBureausQuery}
                useDeleteMutation={useDeleteKmpBureauMutation}
              />
            </Grid>
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


















const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
        setExcelUploadError(null);
        setIsUploading(true);

        const file = event.target.files?.[0];
        if (!file) {
            setIsUploading(false);
            return;
        }

        // File type check
        if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
            setExcelUploadError("Please upload a valid Excel file (.xlsx or .xls)");
            setIsUploading(false);
            return;
        }

        // File size check
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setExcelUploadError(`File size should not exceed ${MAX_FILE_SIZE_MB} MB`);
            setIsUploading(false);
            return;
        }

        const buffer = await file.arrayBuffer();
        const workbookExcelJS = new ExcelJS.Workbook();
        await workbookExcelJS.xlsx.load(buffer);

        // Access worksheets by index (1-based in Excel, but 0-based in array)
        const lenderTlSheet = workbookExcelJS.worksheets[1];   // Sheet 2
        const lenderOdSheet = workbookExcelJS.worksheets[2];   // Sheet 3
        const lenderMasterSheet = workbookExcelJS.worksheets[3]; // Sheet 4 → This is your Sheet 3 in UI

        // === VALIDATE HIDDEN KEY IN LENDER MASTER SHEET (Sheet 3 in template) ===
        if (!lenderMasterSheet) {
            throw new Error("Lender Master sheet (Sheet 3) is missing in the uploaded file.");
        }

        // Check hidden validation cell - commonly Z1 or A1 in hidden sheet
        const validationCell = lenderMasterSheet.getCell('Z1'); // You can change to 'A1' if needed
        const hiddenKey = validationCell.value?.toString().trim();

        if (hiddenKey !== "readonly@2025") {
            setExcelUploadError("Invalid or tampered template. Please download the latest template and fill it correctly.");
            setOpenSnackbar(true);
            setSeverity("error");
            setSnackMsg("Template validation failed. Use the original downloaded file.");
            setIsUploading(false);
            return;
        }

        // === Proceed only if validation passes ===
        if (!lenderTlSheet || !lenderOdSheet) {
            throw new Error("Required sheets are missing. Please use the correct template.");
        }

        const parseSheetDataExcelJS = (worksheet: ExcelJS.Worksheet) => {
            const jsonData: any[] = [];
            worksheet.eachRow({ includeEmpty: true }, (row: any, rowNumber: number) => {
                if (rowNumber >= 3) { // Skip header rows (assuming data starts from row 3)
                    jsonData.push(row.values);
                }
            });
            return jsonData;
        };

        const lenderTlData = parseSheetDataExcelJS(lenderTlSheet);
        const lenderOdData = parseSheetDataExcelJS(lenderOdSheet);

        setExcelData({
            lenderTl: lenderTlData,
            lenderOd: lenderOdData,
        });

        setIsUploading(false);
        setOpenSnackbar(true);
        setSeverity("success");
        setSnackMsg("Excel file uploaded and validated successfully!");

    } catch (error: any) {
        console.error("Excel upload error:", error);
        setExcelUploadError(error.message || "Invalid Excel file or incorrect template format.");
        setOpenSnackbar(true);
        setSeverity("error");
        setSnackMsg("Failed to process Excel file. Please use the correct template.");
        setIsUploading(false);
    } finally {
        setIsUploading(false);
        if (event.target) event.target.value = "";
    }
};








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
