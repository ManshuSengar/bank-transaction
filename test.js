import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Modal,
  Box,
  Typography,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  tableCellClasses,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Slide from "@mui/material/Slide";
import { TransitionProps } from "@mui/material/transitions";
import { BankStatement } from "../../models/bankStatement";
import useToken from "../../Features/Authentication/useToken";
import { Document as PdfDocument, Page, pdfjs } from "react-pdf";
import * as XLSX from "xlsx";

// CRITICAL FIX: Configure worker only once at module level
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

interface DownloadDocumentsDetailsModalProps {
  open: boolean;
  onClose: () => void;
  docUrl: BankStatement | null;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const DialogCss = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    border: "3px solid #334d59 !important",
    boxShadow: "8px 10px 20px 5px #334d59",
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: "#E6F4FF",
    color: "#3B415B",
    borderBottomWidth: 0,
    "@media (max-width: 767px)": {
      paddingTop: "8px",
      paddingBottom: "8px",
    },
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
    color: "#24172E",
    borderBottomWidth: 0,
    "@media (max-width: 767px)": {
      paddingTop: "6px",
      paddingBottom: "6px",
    },
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  "&:nth-of-type(even)": {
    backgroundColor: "#ebeff2",
  },
  "&:last-child td, &:last-child th": {
    border: 0,
  },
}));

const DownloadBankStatementDetailsModal: React.FC<
  DownloadDocumentsDetailsModalProps
> = ({ open, onClose, docUrl }) => {
  const { getToken } = useToken();
  const [loading, setLoading] = useState(false);
  const [excelData, setExcelData] = useState<string[][]>([]);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoize file extension calculation
  const fileExtension = useMemo(() => {
    if (!docUrl?.name) return "";
    return docUrl.name.split(".").pop()?.toLowerCase() || "";
  }, [docUrl?.name]);

  const isPDF = fileExtension === "pdf";
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp"].includes(fileExtension);
  const isExcel = ["xls", "xlsx", "csv"].includes(fileExtension);

  // Memoize the document URL with token
  const documentUrl = useMemo(() => {
    if (!docUrl?.url) return "";
    return `${docUrl.url}?access_token=${getToken()}`;
  }, [docUrl?.url, getToken]);

  // Cleanup function
  useEffect(() => {
    return () => {
      // Abort any ongoing fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load Excel data
  useEffect(() => {
    if (!open || !isExcel || !documentUrl) {
      return;
    }

    setLoading(true);
    setExcelData([]);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    fetch(documentUrl, { signal: abortControllerRef.current.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
        }) as string[][];

        const maxColumns = Math.max(...json.map((row) => row.length));
        const normalized = json.map((row) => {
          const newRow = [...row];
          while (newRow.length < maxColumns) {
            newRow.push("");
          }
          return newRow;
        });

        setExcelData(normalized);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error("Error loading Excel file:", err);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    // Cleanup on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, isExcel, documentUrl]);

  // Reset states when modal closes
  useEffect(() => {
    if (!open) {
      setExcelData([]);
      setPdfError(null);
      setNumPages(null);
      setLoading(false);
    }
  }, [open]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
    setPdfError("Failed to load PDF. Please try downloading the file instead.");
  };

  const handleDialogClose = () => {
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  };

  return (
    <DialogCss
      open={open}
      TransitionComponent={Transition}
      keepMounted
      onClose={handleDialogClose}
      aria-describedby="alert-dialog-slide-description"
      fullWidth={true}
      maxWidth={"md"}
      disableAutoFocus
      disableEnforceFocus
      ref={dialogRef}
    >
      <DialogTitle
        sx={{
          textAlign: "center",
          background: "linear-gradient(to top, #b2c7ef, #779de2)",
          padding: "6px 24px",
          fontSize: "16px",
          fontWeight: 700,
        }}
      >
        {"Document Preview"} - {docUrl?.name}
      </DialogTitle>
      <DialogContent sx={{ px: 0 }}>
        {isPDF ? (
          <Box sx={{ textAlign: "center" }}>
            {pdfError ? (
              <Typography color="error" sx={{ my: 2 }}>
                {pdfError}
              </Typography>
            ) : (
              <PdfDocument
                file={documentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <Box sx={{ my: 3 }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Loading PDF...</Typography>
                  </Box>
                }
                error={
                  <Typography color="error" sx={{ my: 2 }}>
                    Failed to load PDF
                  </Typography>
                }
              >
                <Page 
                  pageNumber={1} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </PdfDocument>
            )}
            {numPages && (
              <Typography variant="caption" sx={{ mt: 2, display: "block" }}>
                Page 1 of {numPages}
              </Typography>
            )}
          </Box>
        ) : isImage ? (
          <Box sx={{ textAlign: "center" }}>
            <img
              src={documentUrl}
              alt={String(docUrl?.name)}
              style={{ maxWidth: "100%", maxHeight: "600px" }}
              onError={(e) => {
                console.error("Image load error");
                e.currentTarget.style.display = "none";
              }}
            />
          </Box>
        ) : isExcel ? (
          loading ? (
            <Box sx={{ textAlign: "center", my: 3 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Loading Excel data...</Typography>
            </Box>
          ) : excelData.length > 0 ? (
            <Paper
              elevation={0}
              style={{
                marginBottom: "24px",
                boxShadow: "none",
                border: "1px solid #1377FF",
                borderRadius: "6px",
                maxHeight: "600px",
                overflow: "auto",
              }}
            >
              <TableContainer>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      {excelData[0]?.map((cell, index) => (
                        <StyledTableCell key={index}>
                          <Typography
                            variant="subtitle2"
                            display="block"
                            gutterBottom
                            sx={{ m: 0, p: 0 }}
                          >
                            {cell}
                          </Typography>
                        </StyledTableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excelData.slice(1).map((row, rowIndex) => (
                      <StyledTableRow key={rowIndex}>
                        {row.map((cell, index) => (
                          <StyledTableCell key={index}>
                            <Typography
                              variant="body1"
                              display="block"
                              gutterBottom
                              sx={{ m: 0, p: 0 }}
                            >
                              {cell}
                            </Typography>
                          </StyledTableCell>
                        ))}
                      </StyledTableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : (
            <Typography variant="body1" sx={{ textAlign: "center", my: 3 }}>
              No data available
            </Typography>
          )
        ) : (
          <Box sx={{ textAlign: "center", my: 3 }}>
            <Typography variant="body1" gutterBottom>
              File preview not supported for this file type.
            </Typography>
            <Button
              variant="contained"
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mt: 2 }}
            >
              Download File
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{ borderTop: "2px solid #334d59", padding: "6px 16px" }}
      >
        <Button onClick={handleDialogClose}>Close</Button>
      </DialogActions>
    </DialogCss>
  );
};

export default React.memo(DownloadBankStatementDetailsModal);


 import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Modal,
  Box,
  Typography,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  tableCellClasses,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Slide from "@mui/material/Slide";
import { TransitionProps } from "@mui/material/transitions";
import { BankStatement } from "../../models/bankStatement";
import useToken from "../../Features/Authentication/useToken";
import { Document as PdfDocument, Page, pdfjs } from "react-pdf";
import * as XLSX from "xlsx";

// CRITICAL FIX: Configure worker only once at module level
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

interface DownloadDocumentsDetailsModalProps {
  open: boolean;
  onClose: () => void;
  docUrl: BankStatement | null;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const DialogCss = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    border: "3px solid #334d59 !important",
    boxShadow: "8px 10px 20px 5px #334d59",
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: "#E6F4FF",
    color: "#3B415B",
    borderBottomWidth: 0,
    "@media (max-width: 767px)": {
      paddingTop: "8px",
      paddingBottom: "8px",
    },
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
    color: "#24172E",
    borderBottomWidth: 0,
    "@media (max-width: 767px)": {
      paddingTop: "6px",
      paddingBottom: "6px",
    },
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  "&:nth-of-type(even)": {
    backgroundColor: "#ebeff2",
  },
  "&:last-child td, &:last-child th": {
    border: 0,
  },
}));

const DownloadBankStatementDetailsModal: React.FC<
  DownloadDocumentsDetailsModalProps
> = ({ open, onClose, docUrl }) => {
  const { getToken } = useToken();
  const [loading, setLoading] = useState(false);
  const [excelData, setExcelData] = useState<string[][]>([]);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoize file extension calculation
  const fileExtension = useMemo(() => {
    if (!docUrl?.name) return "";
    return docUrl.name.split(".").pop()?.toLowerCase() || "";
  }, [docUrl?.name]);

  const isPDF = fileExtension === "pdf";
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp"].includes(fileExtension);
  const isExcel = ["xls", "xlsx", "csv"].includes(fileExtension);

  // Memoize the document URL with token
  const documentUrl = useMemo(() => {
    if (!docUrl?.url) return "";
    return `${docUrl.url}?access_token=${getToken()}`;
  }, [docUrl?.url, getToken]);

  // Cleanup function
  useEffect(() => {
    return () => {
      // Abort any ongoing fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load Excel data
  useEffect(() => {
    if (!open || !isExcel || !documentUrl) {
      return;
    }

    setLoading(true);
    setExcelData([]);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    fetch(documentUrl, { signal: abortControllerRef.current.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
        }) as string[][];

        const maxColumns = Math.max(...json.map((row) => row.length));
        const normalized = json.map((row) => {
          const newRow = [...row];
          while (newRow.length < maxColumns) {
            newRow.push("");
          }
          return newRow;
        });

        setExcelData(normalized);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error("Error loading Excel file:", err);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    // Cleanup on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, isExcel, documentUrl]);

  // Reset states when modal closes
  useEffect(() => {
    if (!open) {
      setExcelData([]);
      setPdfError(null);
      setNumPages(null);
      setLoading(false);
    }
  }, [open]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
    setPdfError("Failed to load PDF. Please try downloading the file instead.");
  };

  const handleDialogClose = () => {
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  };

  return (
    <DialogCss
      open={open}
      TransitionComponent={Transition}
      keepMounted
      onClose={handleDialogClose}
      aria-describedby="alert-dialog-slide-description"
      fullWidth={true}
      maxWidth={"md"}
      disableAutoFocus
      disableEnforceFocus
      ref={dialogRef}
    >
      <DialogTitle
        sx={{
          textAlign: "center",
          background: "linear-gradient(to top, #b2c7ef, #779de2)",
          padding: "6px 24px",
          fontSize: "16px",
          fontWeight: 700,
        }}
      >
        {"Document Preview"} - {docUrl?.name}
      </DialogTitle>
      <DialogContent sx={{ px: 0 }}>
        {isPDF ? (
          <Box sx={{ textAlign: "center" }}>
            {pdfError ? (
              <Typography color="error" sx={{ my: 2 }}>
                {pdfError}
              </Typography>
            ) : (
              <PdfDocument
                file={documentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <Box sx={{ my: 3 }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Loading PDF...</Typography>
                  </Box>
                }
                error={
                  <Typography color="error" sx={{ my: 2 }}>
                    Failed to load PDF
                  </Typography>
                }
              >
                <Page 
                  pageNumber={1} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </PdfDocument>
            )}
            {numPages && (
              <Typography variant="caption" sx={{ mt: 2, display: "block" }}>
                Page 1 of {numPages}
              </Typography>
            )}
          </Box>
        ) : isImage ? (
          <Box sx={{ textAlign: "center" }}>
            <img
              src={documentUrl}
              alt={String(docUrl?.name)}
              style={{ maxWidth: "100%", maxHeight: "600px" }}
              onError={(e) => {
                console.error("Image load error");
                e.currentTarget.style.display = "none";
              }}
            />
          </Box>
        ) : isExcel ? (
          loading ? (
            <Box sx={{ textAlign: "center", my: 3 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Loading Excel data...</Typography>
            </Box>
          ) : excelData.length > 0 ? (
            <Paper
              elevation={0}
              style={{
                marginBottom: "24px",
                boxShadow: "none",
                border: "1px solid #1377FF",
                borderRadius: "6px",
                maxHeight: "600px",
                overflow: "auto",
              }}
            >
              <TableContainer>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      {excelData[0]?.map((cell, index) => (
                        <StyledTableCell key={index}>
                          <Typography
                            variant="subtitle2"
                            display="block"
                            gutterBottom
                            sx={{ m: 0, p: 0 }}
                          >
                            {cell}
                          </Typography>
                        </StyledTableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excelData.slice(1).map((row, rowIndex) => (
                      <StyledTableRow key={rowIndex}>
                        {row.map((cell, index) => (
                          <StyledTableCell key={index}>
                            <Typography
                              variant="body1"
                              display="block"
                              gutterBottom
                              sx={{ m: 0, p: 0 }}
                            >
                              {cell}
                            </Typography>
                          </StyledTableCell>
                        ))}
                      </StyledTableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : (
            <Typography variant="body1" sx={{ textAlign: "center", my: 3 }}>
              No data available
            </Typography>
          )
        ) : (
          <Box sx={{ textAlign: "center", my: 3 }}>
            <Typography variant="body1" gutterBottom>
              File preview not supported for this file type.
            </Typography>
            <Button
              variant="contained"
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mt: 2 }}
            >
              Download File
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{ borderTop: "2px solid #334d59", padding: "6px 16px" }}
      >
        <Button onClick={handleDialogClose}>Close</Button>
      </DialogActions>
    </DialogCss>
  );
};

export default DownloadBankStatementDetailsModal;           













import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slide,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  tableCellClasses,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { TransitionProps } from "@mui/material/transitions";
import { BankStatement } from "../../models/bankStatement";
import useToken from "../../Features/Authentication/useToken";
import { Document as PdfDocument, Page, pdfjs } from "react-pdf";
import * as XLSX from "xlsx";

// Set the workerSrc to a local file
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

interface DownloadDocumentsDetailsModalProps {
  open: boolean;
  onClose: () => void;
  docUrl: BankStatement | null;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: "#E6F4FF",
    color: "#3B415B",
    borderBottomWidth: 0,
    "@media (max-width: 767px)": { paddingTop: "8px", paddingBottom: "8px" },
    "@media (min-width: 768px) and (max-width: 1024px)": { paddingTop: "8px", paddingBottom: "8px" },
    "@media (min-width: 1025px) and (max-width: 1440px)": { paddingTop: "8px", paddingBottom: "8px" },
    "@media (min-width: 1441px)": { paddingTop: "10px", paddingBottom: "10px" },
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
    color: "#24172E",
    borderBottomWidth: 0,
    "@media (max-width: 767px)": { paddingTop: "6px", paddingBottom: "6px" },
    "@media (min-width: 768px) and (max-width: 1024px)": { paddingTop: "6px", paddingBottom: "6px" },
    "@media (min-width: 1025px) and (max-width: 1440px)": { paddingTop: "8px", paddingBottom: "8px" },
    "@media (min-width: 1441px)": { paddingTop: "10px", paddingBottom: "10px" },
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  "&:nth-of-type(even)": { backgroundColor: "#ebeff2" },
  "&:last-child td, &:last-child th": { border: 0 },
}));

const DialogCss = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    border: "3px solid #334d59 !important",
    boxShadow: "8px 10px 20px 5px #334d59",
  },
}));

const DownloadBankStatementDetailsModal: React.FC<
  DownloadDocumentsDetailsModalProps
> = ({ open, onClose, docUrl }) => {
  const { getToken } = useToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<string[][]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const stableDocUrl = useMemo(() => docUrl, [docUrl?.url, docUrl?.name]);

  const getFileExtension = (filename: string) => {
    return filename.split(".").pop()?.toLowerCase() || "";
  };

  const fileExtension = getFileExtension(String(stableDocUrl?.name || ""));
  const isPDF = fileExtension === "pdf";
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp"].includes(fileExtension);
  const isExcel = ["xls", "xlsx", "csv"].includes(fileExtension);

  useEffect(() => {
    if (stableDocUrl && isExcel) {
      setLoading(true);
      setError(null);
      console.log("Fetching Excel file:", stableDocUrl.url);
      fetch(`${stableDocUrl?.url}?access_token=${getToken()}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch Excel file");
          return res.arrayBuffer();
        })
        .then((data) => {
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

          const maxColumns = Math.max(...json.map((row) => row.length));
          const normalized = json.map((row) => {
            const newRow = [...row];
            while (newRow.length < maxColumns) {
              newRow.push("");
            }
            return newRow;
          });

          setExcelData(normalized);
        })
        .catch((err) => {
          setError(err.message);
          console.error("Error loading Excel file:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [stableDocUrl, getToken]);

  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.blur();
    }
  }, [open]);

  return (
    <DialogCss
      open={open}
      TransitionComponent={Transition}
      keepMounted
      onClose={onClose}
      aria-describedby="alert-dialog-slide-description"
      fullWidth={true}
      maxWidth={"md"}
      disableAutoFocus
      disableEnforceFocus
      ref={dialogRef}
    >
      <DialogTitle
        sx={{
          textAlign: "center",
          background: "linear-gradient(to top, #b2c7ef, #779de2)",
          padding: "6px 24px",
          fontSize: "16px",
          fontWeight: 700,
        }}
      >
        Document Preview - {stableDocUrl?.name}
      </DialogTitle>
      <DialogContent sx={{ px: 0 }}>
        {error && (
          <Typography variant="body1" sx={{ textAlign: "center", my: 3, color: "red" }}>
            {error}
          </Typography>
        )}
        {isPDF ? (
          <PdfDocument
            file={`${stableDocUrl?.url}/view?access_token=${getToken()}`}
            onLoadError={(error) => {
              console.error("PDF load error:", error);
              setError("Failed to load PDF");
            }}
            onLoadSuccess={(pdf) => {
              console.log("Loaded PDF:", pdf.numPages);
              setLoading(false);
            }}
          >
            <Page pageNumber={1} />
          </PdfDocument>
        ) : isImage ? (
          <img
            src={`${stableDocUrl?.url}?access_token=${getToken()}`}
            alt={String(stableDocUrl?.name)}
            style={{ maxWidth: "100%", maxHeight: "600px" }}
          />
        ) : isExcel ? (
          loading ? (
            <Typography variant="body1" sx={{ textAlign: "center", my: 3 }}>
              Loading Excel data...
            </Typography>
          ) : (
            <Paper
              elevation={0}
              style={{
                marginBottom: "24px",
                boxShadow: "none",
                border: "1px solid #1377FF",
                borderRadius: "6px",
              }}
            >
              <TableContainer>
                <Table id="breparameters_table">
                  <TableHead>
                    <TableRow>
                      {excelData[0]?.map((cell, index) => (
                        <StyledTableCell key={index}>
                          <Typography
                            variant="subtitle2"
                            display="block"
                            gutterBottom
                            sx={{ m: 0, p: 0 }}
                          >
                            {cell}
                          </Typography>
                        </StyledTableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excelData.slice(1).map((row, rowIndex) => (
                      <StyledTableRow key={rowIndex}>
                        {row.map((cell, index) => (
                          <StyledTableCell key={index}>
                            <Typography
                              variant="body1"
                              display="block"
                              gutterBottom
                              sx={{ m: 0, p: 0 }}
                            >
                              {cell}
                            </Typography>
                          </StyledTableCell>
                        ))}
                      </StyledTableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )
        ) : (
          <div>
            <p>File preview not supported.</p>
            <a
              href={`${stableDocUrl?.url}?access_token=${getToken()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download File
            </a>
          </div>
        )}
      </DialogContent>
      <DialogActions
        sx={{ borderTop: "2px solid #334d59", padding: "6px 16px" }}
      >
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </DialogCss>
  );
};

export default DownloadBankStatementDetailsModal;










import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Container,
  Paper,
  Stack,
  Card,
  CardContent,
  Divider,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { QrCode, ArrowBack, Download, Share } from '@mui/icons-material';

interface QrDisplayState {
  qrImageData: string | Blob;
  eventData: {
    eventName: string;
    eventId: string;
  };
}

const QrDisplayPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const state = location.state as QrDisplayState;

  useEffect(() => {
    if (!state || !state.qrImageData || !state.eventData) {
      setError('No QR code data found. Please generate a new QR code.');
      setLoading(false);
      return;
    }

    const processImageData = async () => {
      try {
        if (typeof state.qrImageData === 'string') {
          // Handle base64 string
          if (state.qrImageData.startsWith('data:image')) {
            setQrImageUrl(state.qrImageData);
          } else {
            setQrImageUrl(`data:image/png;base64,${state.qrImageData}`);
          }
        } else if (state.qrImageData instanceof Blob) {
          // Convert Blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              setQrImageUrl(reader.result);
            } else {
              setError('Failed to convert QR code image to base64.');
            }
            setLoading(false);
          };
          reader.onerror = () => {
            setError('Error reading QR code image.');
            setLoading(false);
          };
          reader.readAsDataURL(state.qrImageData);
        } else {
          setError('Unsupported QR code data format.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error processing QR image:', err);
        setError('Failed to display QR code image.');
        setLoading(false);
      }
    };

    processImageData();
  }, [state]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleBackToDashboard = () => {
    navigate('/');
  };

  const handleDownloadQr = () => {
    if (!qrImageUrl) return;
    const link = document.createElement('a');
    link.href = qrImageUrl; // Use the base64 data URL
    link.download = `${state.eventData.eventName}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareQr = async () => {
    if (!qrImageUrl || !navigator.share || !navigator.canShare()) {
      handleDownloadQr(); // Fallback to download if sharing is not supported
      return;
    }

    try {
      // Convert base64 to Blob for sharing
      const base64String = qrImageUrl.split(',')[1]; // Extract base64 data
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const file = new File([blob], `${state.eventData.eventName}-qr.png`, {
        type: 'image/png',
      });

      await navigator.share({
        title: `QR Code for ${state.eventData.eventName}`,
        text: `Scan this QR code to join the event: ${state.eventData.eventName}`,
        files: [file],
      });
    } catch (err) {
      console.error('Error sharing:', err);
      handleDownloadQr(); // Fallback to download on error
    }
  };

  const handleScanComplete = () => {
    navigate('/create-user-event', {
      state: { eventData: state.eventData },
    });
  };

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(to right, #e3f2fd, #fce4ec)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Container maxWidth="sm">
          <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              onClick={() => navigate('/create-event')}
              fullWidth
            >
              Create New Event
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(to right, #e3f2fd, #fce4ec)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Container maxWidth="md">
        <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary" gutterBottom>
                <QrCode sx={{ mr: 1, verticalAlign: 'middle' }} />
                Event QR Code
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Share this QR code with attendees to join your event
              </Typography>
            </Box>

            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <Typography variant="h6" color="primary">
                    Event Details
                  </Typography>
                  <Chip label="Active" color="success" size="small" />
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Event Name:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {state?.eventData?.eventName}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Event ID:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {state?.eventData?.eventId}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Box textAlign="center">
                  {loading ? (
                    <Stack spacing={2} alignItems="center" py={4}>
                      <CircularProgress />
                      <Typography>Loading QR Code...</Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={2} alignItems="center">
                      <img
                        src={qrImageUrl}
                        alt="Event QR Code"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: 'white',
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Scan this code with your mobile device to join the event
                      </Typography>
                    </Stack>
                  )}
                </Box>
              </CardContent>
            </Card>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadQr}
                disabled={loading || !qrImageUrl}
              >
                Download QR
              </Button>
              <Button
                variant="outlined"
                startIcon={<Share />}
                onClick={handleShareQr}
                disabled={loading || !qrImageUrl}
              >
                Share QR
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleScanComplete}
                disabled={loading}
                sx={{ flexGrow: 1 }}
              >
                Create User Event
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={handleBack}
                fullWidth
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleBackToDashboard}
                fullWidth
              >
                Back to Dashboard
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default QrDisplayPage;















import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Container,
  Paper,
  Stack,
  Card,
  CardContent,
  Divider,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { QrCode, ArrowBack, Download, Share } from '@mui/icons-material';

interface QrDisplayState {
  qrImageData: string | Blob;
  eventData: {
    eventName: string;
    eventId: string;
  };
}

const QrDisplayPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const state = location.state as QrDisplayState;

  useEffect(() => {
    if (!state || !state.qrImageData || !state.eventData) {
      setError('No QR code data found. Please generate a new QR code.');
      setLoading(false);
      return;
    }

    try {
      if (typeof state.qrImageData === 'string') {
        if (state.qrImageData.startsWith('data:image')) {
          setQrImageUrl(state.qrImageData);
        } else {
          setQrImageUrl(`data:image/png;base64,${state.qrImageData}`);
        }
      } else if (state.qrImageData instanceof Blob) {
        const url = URL.createObjectURL(state.qrImageData);
        setQrImageUrl(url);
        return () => URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([state.qrImageData], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setQrImageUrl(url);
        return () => URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error processing QR image:', err);
      setError('Failed to display QR code image.');
    } finally {
      setLoading(false);
    }
  }, [state]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleBackToDashboard = () => {
    navigate('/');
  };

  const handleDownloadQr = () => {
    if (!qrImageUrl) return;
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `${state.eventData.eventName}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareQr = async () => {
    if (navigator.share && navigator.canShare()) {
      try {
        const response = await fetch(qrImageUrl);
        const blob = await response.blob();
        const file = new File([blob], `${state.eventData.eventName}-qr.png`, {
          type: 'image/png',
        });

        await navigator.share({
          title: `QR Code for ${state.eventData.eventName}`,
          text: `Scan this QR code to join the event: ${state.eventData.eventName}`,
          files: [file],
        });
      } catch (err) {
        console.error('Error sharing:', err);
        handleDownloadQr();
      }
    } else {
      handleDownloadQr();
    }
  };

  // const handleScanComplete = () => {
  //   navigate('/qr-scan-success', {
  //     state: { eventData: state.eventData }
  //   });
  // };

  const handleScanComplete = () => {
    navigate('/create-user-event', {
      state: { eventData: state.eventData }
    });
  };


  

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(to right, #e3f2fd, #fce4ec)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Container maxWidth="sm">
          <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              onClick={() => navigate('/create-event')}
              fullWidth
            >
              Create New Event
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(to right, #e3f2fd, #fce4ec)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Container maxWidth="md">
        <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary" gutterBottom>
                <QrCode sx={{ mr: 1, verticalAlign: 'middle' }} />
                Event QR Code
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Share this QR code with attendees to join your event
              </Typography>
            </Box>

            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <Typography variant="h6" color="primary">
                    Event Details
                  </Typography>
                  <Chip label="Active" color="success" size="small" />
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Event Name:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {state?.eventData?.eventName}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Event ID:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {state?.eventData?.eventId}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Box textAlign="center">
                  {loading ? (
                    <Stack spacing={2} alignItems="center" py={4}>
                      <CircularProgress />
                      <Typography>Loading QR Code...</Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={2} alignItems="center">
                      <img
                        src={qrImageUrl}
                        alt="Event QR Code"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: 'white',
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Scan this code with your mobile device to join the event
                      </Typography>
                    </Stack>
                  )}
                </Box>
              </CardContent>
            </Card>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadQr}
                disabled={loading || !qrImageUrl}
              >
                Download QR
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Share />}
                onClick={handleShareQr}
                disabled={loading || !qrImageUrl}
              >
                Share QR
              </Button>
              
              <Button
                variant="contained"
                color="success"
                onClick={handleScanComplete}
                disabled={loading}
                sx={{ flexGrow: 1 }}
              >
                Create User Event
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={handleBack}
                fullWidth
              >
                Back
              </Button>
              
              <Button
                variant="contained"
                color="primary"
                onClick={handleBackToDashboard}
                fullWidth
              >
                Back to Dashboard
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default QrDisplayPage;

import React, { useEffect, useState } from 'react';
import {
  Box, TextField, Button, Typography, Container, Paper, Stack,
  CircularProgress, Alert, RadioGroup, FormControlLabel, Radio,
  FormControl, FormLabel, Select, MenuItem, IconButton,
  Modal, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import QrApi from 'store/services/qrApi';
import MemberApi from 'store/services/memberApi';

const CreateQR = () => {
  const [formData, setFormData] = useState({
    eventName: '',
    eventId: '',
    selectedMember: '',
    eventOemflg: ''
  });
  const [memberList, setMemberList] = useState<any>([]);
  const [selectionType, setSelectionType] = useState<'eventId' | 'member'>('eventId');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newOemData, setNewOemData] = useState({
    oemCode: '',
    oemNamec: ''
  });
  const navigate = useNavigate();

  const sanitizeInput = (value: string): string => {
    return value.replace(/<[^>]+>|[<>{}?]/g, '');
  };

  const handleChange:any = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name as string]: typeof value === 'string' ? sanitizeInput(value) : value }));
    if (error) setError(null);
  };

  const handleNewOemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewOemData((prev) => ({ ...prev, [name as string]: sanitizeInput(value) }));
  };

  const validateForm = () => {
    if (!formData.eventName.trim()) {
      setError('Event Name is required');
      return false;
    }
    if (formData.eventName.length < 3) {
      setError('Event Name must be at least 3 characters long');
      return false;
    }
    if (selectionType === 'eventId' && !formData.eventId.trim()) {
      setError('Event ID is required');
      return false;
    }
    if (selectionType === 'member' && !formData.selectedMember.trim()) {
      setError('Please select a member');
      return false;
    }
    return true;
  };

  const validateNewOemForm = () => {
    if (!newOemData.oemCode.trim()) {
      setError('OEM Code is required');
      return false;
    }
    if (!newOemData.oemNamec.trim()) {
      setError('OEM Name is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const payload = {
        eventName: formData.eventName,
        eventId: selectionType === 'eventId' ? formData.eventId : formData.selectedMember,
        eventOemflg: selectionType,
        oemName: formData.selectedMember || "",
      };
      const response = await QrApi.generateQr(payload);
      navigate('/qr-display', {
        state: {
          qrImageData: response?.imageData,
          eventData: payload,
        },
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to generate QR code.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNewOemForm()) return;

    setLoading(true);
    setError(null);

    try {
      await MemberApi.saveOemMasterDetail(newOemData);
      setModalOpen(false);
      setNewOemData({ oemCode: '', oemNamec: '' });
      await getOemMasterDetail(); 
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to add OEM details.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getOemMasterDetail();
  }, []);

  const getOemMasterDetail = async () => {
    try {
      const response: any = await MemberApi.getEventDetails();
      console.log("response", response);
      setMemberList(response.result);
    } catch (err) {
      console.log("err", err);
      setError('Failed to fetch member list');
    }
  };

  const handleBackToDashboard = () => {
    navigate('/');
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setNewOemData({ oemCode: '', oemNamec: '' });
    setError(null);
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(to right, #e3f2fd, #fce4ec)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Container maxWidth="sm">
        <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h4" align="center" gutterBottom color="primary">
            Create QR
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
            <TextField
              label="Event Name"
              name="eventName"
              value={formData.eventName}
              onChange={handleChange}
              variant="outlined"
              fullWidth
              required
              disabled={loading}
              sx={{ mb: 3 }}
              helperText="Enter a descriptive name for your event"
            />
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">Choose Identifier</FormLabel>
              <RadioGroup
                row
                value={selectionType}
                onChange={(e) => setSelectionType(e.target.value as 'eventId' | 'member')}
              >
                <FormControlLabel value="eventId" control={<Radio />} label="Event ID" />
                <FormControlLabel value="member" control={<Radio />} label="Member" />
              </RadioGroup>
            </FormControl>
            {selectionType === 'eventId' ? (
              <TextField
                label="Event ID"
                name="eventId"
                value={formData.eventId}
                onChange={handleChange}
                variant="outlined"
                fullWidth
                required
                disabled={loading}
                sx={{ mb: 3 }}
                helperText="Enter a unique identifier for your event"
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <FormControl fullWidth>
                  <Select
                    name="selectedMember"
                    value={formData.selectedMember}
                    onChange={handleChange}
                    disabled={loading}
                    displayEmpty
                  >
                    <MenuItem value="" disabled>Select a member</MenuItem>
                    {memberList?.map((member: any) => (
                      <MenuItem key={member?.oemCode} value={member?.oemCode}>{member?.oemNamec}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  color="primary"
                  onClick={() => setModalOpen(true)}
                  disabled={loading}
                >
                  <AddIcon />
                </IconButton>
              </Box>
            )}
            <Stack direction="row" spacing={2}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : null}
              >
                {loading ? 'Generating QR...' : 'Generate QR Code'}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                onClick={handleBackToDashboard}
                disabled={loading}
              >
                Back to Dashboard
              </Button>
            </Stack>
          </form>
        </Paper>
      </Container>

      <Dialog open={modalOpen} onClose={handleModalClose}>
        <DialogTitle>Add New OEM</DialogTitle>
        <DialogContent>
          <TextField
            label="OEM Code"
            name="oemCode"
            value={newOemData.oemCode}
            onChange={handleNewOemChange}
            variant="outlined"
            fullWidth
            required
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            label="OEM Name"
            name="oemNamec"
            value={newOemData.oemNamec}
            onChange={handleNewOemChange}
            variant="outlined"
            fullWidth
            required
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleModalClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleAddOemSubmit}
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Adding...' : 'Add OEM'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CreateQR;

import axios, { AxiosResponse, AxiosError } from "axios";
const API_BASE_URL = `${process.env.REACT_APP_API_BASE_URL}`;
const REQUEST_TIMEOUT = 30000;
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (process.env.NODE_ENV === 'development') {
            console.log('🚀 API Request:', {
                method: config.method?.toUpperCase(),
                url: config.url,
                baseURL: config.baseURL,
                data: config.data,
            });
        }

        return config;
    },
    (error: AxiosError) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
    }
);

axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
        if (process.env.NODE_ENV === 'development') {
            console.log('✅ API Response:', {
                status: response.status,
                url: response.config.url,
                data: response.data,
            });
        }

        return response;
    },
    (error: AxiosError) => {
        if (process.env.NODE_ENV === 'development') {
            console.error('❌ API Error:', {
                message: error.message,
                status: error.response?.status,
                url: error.config?.url,
                data: error.response?.data,
            });
        }

        if (error.response?.status === 401) {
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');

            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }

        const enhancedError = {
            ...error,
            message: error.response?.data || error.message || 'An unexpected error occurred',
            statusCode: error.response?.status,
            isNetworkError: !error.response,
        };

        return Promise.reject(enhancedError);
    }
);

export interface EventData {
    eventName: string;
    eventId: string;
}

export interface QrCodeResponse {
    imageData: string | Blob;
    imageUrl?: string;
    format?: string;
    size?: {
        width: number;
        height: number;
    };
}

export interface ApiResponse<T = any> {
    data: T;
    message?: string;
    status: string;
    timestamp?: string;
}

export interface EventApiError {
    message: string;
    statusCode?: number;
    isNetworkError?: boolean;
    details?: any;
}

const handleImageResponse = (response: AxiosResponse): QrCodeResponse => {
    const contentType = response.headers['content-type'];

    if (contentType && contentType.includes('image')) {
        return {
            imageData: response.data,
            format: contentType,
        };
    } else if (typeof response.data === 'string') {
        return {
            imageData: response.data,
            format: 'base64',
        };
    } else if (response.data && response.data.imageData) {
        return response.data;
    }

    return {
        imageData: response.data,
    };
};

export const QrApi = {

    getQrCode: async (
        data: EventData,
        options: {
            width?: number;
            height?: number;
            format?: 'png' | 'jpeg' | 'svg';
        } = {}
    ): Promise<QrCodeResponse> => {
        try {
            if (!data?.eventName?.trim()) {
                throw new Error('Event name is required');
            }

            if (!data?.eventId?.trim()) {
                throw new Error('Event ID is required');
            }

            const { width = 200, height = 200, format = 'png' } = options;

            const apiUrl = `/qr/genQRCodeByEvent`;
            const params = new URLSearchParams({
                eventName: data.eventName.trim(),
                eventId: data.eventId.trim(),
                width: width.toString(),
                height: height.toString(),
                format: format,
            });

            const response = await axiosInstance.get(`${apiUrl}?${params.toString()}`, {
                responseType: 'blob',
            });

            return handleImageResponse(response);
        } catch (error) {
            console.error('EventApi.getQrCode error:', error);
            throw error;
        }
    },

    validateEvent: async (data: EventData): Promise<{ isValid: boolean; message?: string }> => {
        try {
            const response = await axiosInstance.post('/event/validate', data);
            return response.data;
        } catch (error) {
            console.error('EventApi.validateEvent error:', error);
            throw error;
        }
    },

    getEventDetails: async (eventId: number): Promise<any> => {
        try {
            if (!eventId) {
                throw new Error('Event ID is required');
            }

            const response = await axiosInstance.get(`/api/getQREventDtls/${eventId}`);
            return response.data;
        } catch (error) {
            console.error('QrApi.getEventDetails error:', error);
            throw error;
        }
    },

    getEventDetailsList: async (): Promise<any> => {
        try {
            const response = await axiosInstance.get('/api/getQREventDtlsList');
            return response.data;
        } catch (error) {
            console.error('QrApi.getEventDetailsList error:', error);
            throw error;
        }
    },

    saveEventDetails: async (eventData: any): Promise<any> => {
        try {
            const response = await axiosInstance.post('/api/saveQREventDtls', eventData);
            return response.data;
        } catch (error) {
            console.error('QrApi.saveEventDetails error:', error);
            throw error;
        }
    },

    recordQrScan: async (data: EventData & { scannedAt?: Date; userAgent?: string }): Promise<any> => {
        try {
            const scanData = {
                ...data,
                scannedAt: data.scannedAt || new Date(),
                userAgent: data.userAgent || navigator.userAgent,
                timestamp: Date.now(),
            };

            const response = await axiosInstance.post('/qr/scan', scanData);
            return response.data;
        } catch (error) {
            console.error('EventApi.recordQrScan error:', error);
            throw error;
        }
    },


    getQrScanStats: async (eventId: string): Promise<any> => {
        try {
            if (!eventId?.trim()) {
                throw new Error('Event ID is required');
            }

            const response = await axiosInstance.get(`/qr/stats/${encodeURIComponent(eventId)}`);
            return response.data;
        } catch (error) {
            console.error('EventApi.getQrScanStats error:', error);
            throw error;
        }
    },

    
    generateQr: async (eventData:any): Promise<any> => {
        try {
            const response = await axiosInstance.post('/qr/genQR', eventData,{
                responseType:'blob'
            });
            return handleImageResponse(response);
        } catch (error) {
            console.error('QrApi.generateQr error:', error);
            throw error;
        }
    },


    updateEvent: async (eventId: string, updateData: Partial<EventData>): Promise<any> => {
        try {
            if (!eventId?.trim()) {
                throw new Error('Event ID is required');
            }

            const response = await axiosInstance.put(`/event/${encodeURIComponent(eventId)}`, updateData);
            return response.data;
        } catch (error) {
            console.error('EventApi.updateEvent error:', error);
            throw error;
        }
    },


    deleteEvent: async (eventId: string): Promise<any> => {
        try {
            if (!eventId?.trim()) {
                throw new Error('Event ID is required');
            }

            const response = await axiosInstance.delete(`/event/${encodeURIComponent(eventId)}`);
            return response.data;
        } catch (error) {
            console.error('EventApi.deleteEvent error:', error);
            throw error;
        }
    },


    getEvents: async (params: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
    } = {}): Promise<any> => {
        try {
            const queryParams = new URLSearchParams();

            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    queryParams.append(key, value.toString());
                }
            });

            const response = await axiosInstance.get(`/event/list?${queryParams.toString()}`);
            return response.data;
        } catch (error) {
            console.error('EventApi.getEvents error:', error);
            throw error;
        }
    },
};

export const handleApiError = (error: any): EventApiError => {
    if (error.response) {
        return {
            message: error.response.data?.message || error.message || 'Server error occurred',
            statusCode: error.response.status,
            isNetworkError: false,
            details: error.response.data,
        };
    } else if (error.request) {
        return {
            message: 'Network error - please check your internet connection',
            isNetworkError: true,
        };
    } else {
        return {
            message: error.message || 'An unexpected error occurred',
            isNetworkError: false,
        };
    }
};

export { axiosInstance };
export default QrApi;

i don't want create url of blob as it's restrited so using other method show qr 
