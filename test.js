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
import { useLazyGetMaterListFilteredQuery } from "../../slices/masterSlice";

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
  const [listKmpBureausQuery] = useLazyListKmpBureausQuery();
  const [masterDataQuery] = useLazyGetMaterListFilteredQuery();

  const kmpListInput: RequestWithParentId<
    SearchRequest<KeyManagemetPersonnel>
  > = {
    parentId: leadId || 0,
    requestValue: {},
  };

  const { data: kmpList } = useListKmpsQuery(kmpListInput);

  const [validationMessage, setValidationMessage] = useState("");

  const validateAllKmps = async () : Promise<boolean> => {
    
    const masterBeneficiaryResponse = await masterDataQuery({
      tableName: "m_beneficiary_type",
      filter:undefined,
      leadId: Number(leadId)
    }).unwrap();
    let overallValidationResult = true;
    console.log("kmpList--> ",JSON.stringify(kmpList),JSON.stringify(masterBeneficiaryResponse));
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

    if (overallValidationResult) {
      const guarantorKey = masterBeneficiaryResponse.find(item => item.value === "Guarantor")?.key || "2";
      const guarantorCount = kmpList.content.filter(item => item.professionalInformation && item.professionalInformation.beneficiaryType === guarantorKey).length;

      if (guarantorCount > 1) {
        setValidationMessage("Cannot have more than one Guarantor.");
        overallValidationResult = false;
      } else if (guarantorCount > 0 && kmpList.content.length < 2) {
        setValidationMessage("If there is a Guarantor, at least one more KMP is mandatory.");
        overallValidationResult = false;
      }
    }

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
      let form60 = kmpKycDocuments?.content.filter(item => item.type === "13");
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
      console.log("kmpList?.content pan",kmpList?.content);
      let kmpWithPan = kmpList?.content.filter(item => item.pan !== undefined && item.pan !== null);
      console.log("kmpwithpan",kmpWithPan);
      if(kmpWithPan.length <= 0) {
        setValidationMessage("Atleast PAN for one individual is mandatory.");
        console.log("Returing false from validateKmp", kmpId);
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
                        <>Appointment Date
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
















kmpList-->  {"content":[{"id":303,"touchedAt":1765167512812,"firstName":"asdasd","lastName":"dasdsad","dob":"1980-03-04T00:00:00.000+00:00","pan":"HLCPS2160D","aadhaarNumber":"4233","beneficiaryCategory":"W","maritalStatus":"1","ckycNumber":"32121312321321","politicallyExposedPerson":"n","unTerroist":"y","panValidationResponseInfo":{"id":353,"touchedAt":1765167512811},"contactInformation":{"id":303,"touchedAt":1765167512810,"email":"dasd@an.com","phoneNumber":"4324324324","address":"fdsfds\nfdsf","state":"51","city":"fsdfsdfsdf","pincode":"324324"},"professionalInformation":{"id":303,"touchedAt":1765184438129,"designation":"Financial","experienceInYear":6,"beneficiaryType":"2","shareHolding":70}}],"currentPage":null,"numberOfElements":1,"totalPages":null} [{"key":"1","value":"Promoter"},{"key":"2","value":"Guarantor"},{"key":"3","value":"Director"},{"key":"4","value":"Partner"},{"key":"5","value":"Company"},{"key":"6","value":"Unincorporated association or Body of Individuals"},{"key":"7","value":"Trust"},{"key":"8","value":"Co applicant"},{"key":"9","value":"Authorised Signatory"}]

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
import { useLazyGetMaterListFilteredQuery } from "../../slices/masterSlice";

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
  const [listKmpBureausQuery] = useLazyListKmpBureausQuery();
   const [masterDataQuery] = useLazyGetMaterListFilteredQuery();

  const kmpListInput: RequestWithParentId<
    SearchRequest<KeyManagemetPersonnel>
  > = {
    parentId: leadId || 0,
    requestValue: {},
  };

  const { data: kmpList } = useListKmpsQuery(kmpListInput);

  const [validationMessage, setValidationMessage] = useState("");

  const validateAllKmps = async () : Promise<boolean> => {
    
    const masterBeneficiaryResponse = await masterDataQuery({
      tableName: "m_beneficiary_type",
      filter:undefined,
      leadId: Number(leadId)
    }).unwrap();
    let overallValidationResult = true;
    console.log("kmpList--> ",JSON.stringify(kmpList),JSON.stringify(masterBeneficiaryResponse));
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
      let form60 = kmpKycDocuments?.content.filter(item => item.type === "13");
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
      console.log("kmpList?.content pan",kmpList?.content);
      let kmpWithPan = kmpList?.content.filter(item => item.pan !== undefined && item.pan !== null);
      console.log("kmpwithpan",kmpWithPan);
      if(kmpWithPan.length <= 0) {
        setValidationMessage("Atleast PAN for one individual is mandatory.");
        console.log("Returing false from validateKmp", kmpId);
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
                        <>Appointment Date
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
