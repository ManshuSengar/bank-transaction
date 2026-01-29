import api from "../app/fileServerApi";

class FileUploadService {

  upload(bucket: string, file: string, onUploadProgress: (progressEvent: any) => void, token: string) {
    let formData = new FormData();

    formData.append("file", file);
    return api({
      method: "post",
      url: `/files/${bucket}`,
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
        "Authorization": `Bearer ${token}`
      },
      onUploadProgress,
    });
  }

  delete(file: {bucket: string, name: string}, token: string) {

    return api({
      method: "delete",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      url: `/files/${file.bucket}/${file.name}`,
    });
  }
}

const fileUploadService = new FileUploadService();

export default fileUploadService;

import { RequestWithParentId } from "../../models/baseModels";
import fileUploadService from "../../slices/fileUploadService";
import { useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import { LinearProgress, Typography } from "@mui/material";
import useToken from "../../Features/Authentication/useToken";
interface ImageUploadProps {
  parentId: any;
  addQuery: any;
}
function FileUpload(props: ImageUploadProps) {
  // const [addQuery, { isLoading }] = props.addQuery && props.addQuery();
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const {getToken} = useToken();
  const onUploadProgress = (progressEvent: any) => {
    setProgress(progressEvent.progress * 100);
  };
  const [error, setError] = useState<String>("");
  const clearError = () => {
    setError("");
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    setUploading(true);
    const files = e.target.files;
    const uploads = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const upload = fileUploadService
        .upload(props.parentId, file, onUploadProgress, getToken())
        .then((response) => {
          setError("");
        })
        .catch((error) => {
          setError(error);
          console.log("error");
        })
        .finally(() => setUploading(false));
      uploads.push(upload);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input type="file" onChange={handleSubmit} />
      {/* {isLoading && (
        <CircularProgress
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
          }}
        />
      )} */}
      {uploading && <LinearProgress variant="determinate" value={progress} />}
      {error && <Typography color={"error"}>Error uploading file</Typography>}
    </div>
  );
}

export default FileUpload;


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
  Paper,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import { styled } from '@mui/material/styles';
import axios from 'axios';
// You can reuse these if already defined in your project
import { useAppSelector } from '../../app/hooks';
import { useUpdateLeadMutation, useGetLeadQuery } from '../../slices/leadSlice';
import { SubmitableForm } from '../../Components/Framework/FormSubmit'; // if needed
import { leadSchema, defaultLead } from '../../models/lead'; // adjust path if needed

// Optional: if you want to store comment in lead model
// Add this field to your lead model/schema if not already present
// legalEntity.dueDiligenceComment?: string;

interface DueDiligenceProps {
  // You can pass vetData or other props later if needed
  onSave?: () => void; 
  leadId?:number// optional callback after save
}

const DueDiligence = React.forwardRef<SubmitableForm, DueDiligenceProps>(
  ({ onSave }, ref) => {
    const { id: leadId } = useAppSelector((state) => state.leadStore);

    // If you're using RTK Query to fetch/update lead
    const { data: leadData } = useGetLeadQuery(leadId || 0, { skip: !leadId });
    const [updateLead, { isLoading: isSaving }] = useUpdateLeadMutation();

    const [comment, setComment] = React.useState<string>(
      ''
    );
    const [snackbarOpen, setSnackbarOpen] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const [snackbarSeverity, setSnackbarSeverity] = React.useState<'success' | 'error'>('success');

    // Sync comment when lead data loads/changes
    React.useEffect(() => {
    //   if (leadData?.legalEntity?.dueDiligenceComment) {
    //     setComment(leadData.legalEntity.dueDiligenceComment);
    //   }

     
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

    const handleDownload = () => {
      setSnackbarMessage('Download started... (implement real logic here)');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      console.log('Downloading due diligence document for lead:', leadId);
    };

    const handleSnackbarClose = () => {
      setSnackbarOpen(false);
    };

    return (
      <Box sx={{ p: 3, backgroundColor: '#fff', borderRadius: 1 }}>
        {/* Header / Title Area */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary">
            Due Diligence
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add notes, observations, or findings from due diligence process
          </Typography>
        </Box>

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
              placeholder="Enter observations, red flags, approvals, recommendations, etc..."
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
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
                sx={{ minWidth: 220 }}
              >
                Download Due Diligence Document
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Feedback Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={5000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
  }
);

export default DueDiligence;



dueReport/dueDeligenceZip?leids=24353 this api will call on handle download so like file upload create new file for due dilegence and call this api in DueDiligence update this and give complete and proper code 


