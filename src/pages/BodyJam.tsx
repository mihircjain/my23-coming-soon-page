// =============================================================================
// 1. BLOOD REPORT UPLOADER COMPONENT
// =============================================================================

import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, Check, X, Eye, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';

const BloodReportUploader = ({ onParametersExtracted }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Handle file selection
  const handleFileSelect = useCallback((event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        if (selectedFile.size <= 10 * 1024 * 1024) { // 10MB limit
          setFile(selectedFile);
          setExtractedData(null);
        } else {
          toast.error('File size must be less than 10MB');
        }
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setExtractedData(null);
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  }, []);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
  }, []);

  // Upload and process file
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProcessing(true);

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'mihir_jain');

      const uploadResponse = await fetch('/api/blood-report/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      toast.success('File uploaded successfully');

      // Process file with AI
      const processResponse = await fetch('/api/blood-report/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: uploadResult.fileId,
          userId: 'mihir_jain'
        })
      });

      if (!processResponse.ok) {
        const error = await processResponse.text();
        throw new Error(error || 'Processing failed');
      }

      const processResult = await processResponse.json();
      setExtractedData(processResult);
      toast.success('Blood parameters extracted successfully');

    } catch (error) {
      console.error('Upload/processing error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  // Confirm extracted parameters
  const handleConfirm = async () => {
    if (!extractedData) return;

    try {
      const response = await fetch('/api/blood-report/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'mihir_jain',
          reportId: extractedData.reportId,
          parameters: extractedData.parameters,
          reportDate: extractedData.reportDate
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save parameters');
      }

      const result = await response.json();
      toast.success('Blood parameters saved successfully');
      
      // Notify parent component
      if (onParametersExtracted) {
        onParametersExtracted(result.parameters);
      }

      // Reset form
      setFile(null);
      setExtractedData(null);

    } catch (error) {
      console.error('Confirmation error:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-purple-600" />
            Upload Blood Report
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload your blood test report PDF and we'll automatically extract all parameters
          </p>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div
              className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Upload className="h-12 w-12 text-purple-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drop your blood report here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse files
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button className="bg-purple-600 hover:bg-purple-700" asChild>
                  <span>Choose PDF File</span>
                </Button>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="font-medium text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFile(null)}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || processing}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {uploading || processing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploading ? 'Uploading...' : processing ? 'Processing...' : 'Process Report'}
                  </Button>
                </div>
              </div>

              {processing && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    AI is analyzing your blood report and extracting parameters. This may take a few moments...
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Parameters Review */}
      {extractedData && (
        <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Extracted Parameters
            </CardTitle>
            <p className="text-sm text-gray-600">
              Review the extracted values and confirm if they look correct
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Report Date */}
              <div className="p-4 bg-white rounded-lg border">
                <h4 className="font-medium text-gray-800 mb-2">Report Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Report Date:</span>
                    <span className="ml-2 font-medium">
                      {extractedData.reportDate ? 
                        new Date(extractedData.reportDate).toLocaleDateString() : 
                        'Not detected'
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Parameters Found:</span>
                    <span className="ml-2 font-medium">
                      {Object.keys(extractedData.parameters).length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Extracted Parameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(extractedData.parameters).map(([key, param]) => (
                  <div key={key} className="p-4 bg-white rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-gray-800">{param.displayName}</h5>
                      <Badge 
                        variant={param.confidence > 0.8 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {Math.round(param.confidence * 100)}%
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg font-bold text-gray-900">
                        {param.value} {param.unit}
                      </div>
                      <div className="text-xs text-gray-500">
                        Normal: {param.normalRange}
                      </div>
                      {param.status && (
                        <Badge 
                          variant={param.status === 'normal' ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {param.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Confidence Summary */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Extraction Summary</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-green-600 font-bold">
                      {Object.values(extractedData.parameters).filter(p => p.confidence > 0.8).length}
                    </div>
                    <div className="text-gray-600">High Confidence</div>
                  </div>
                  <div>
                    <div className="text-yellow-600 font-bold">
                      {Object.values(extractedData.parameters).filter(p => p.confidence >= 0.5 && p.confidence <= 0.8).length}
                    </div>
                    <div className="text-gray-600">Medium Confidence</div>
                  </div>
                  <div>
                    <div className="text-red-600 font-bold">
                      {Object.values(extractedData.parameters).filter(p => p.confidence < 0.5).length}
                    </div>
                    <div className="text-gray-600">Low Confidence</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setExtractedData(null)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirm & Save Parameters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// =============================================================================
// 2. UPDATED BODYJAM WITH UPLOAD FEATURE
// =============================================================================

import { useState, useEffect } from "react";
import { ArrowLeft, Activity, Info, Scale, Heart, Dumbbell, Flame, Apple, Droplet, Upload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from 'sonner';

const BodyJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Blood marker data - will be updated from uploads
  const [bloodMarkers, setBloodMarkers] = useState([
    // ... existing 18 blood markers (keeping the same structure)
    {
      id: "rbc",
      name: "RBC",
      value: 5.80,
      unit: "mill/mm³",
      normalRange: "4.5-5.9 million cells/mcL (men); 4.1-5.1 (women)",
      explanation: "Carries oxygen from lungs to tissues and carbon dioxide back to lungs",
      status: "good",
      category: "blood"
    },
    // ... rest of the markers
  ]);

  // Load latest blood markers from backend
  const loadBloodMarkers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/blood-markers/mihir_jain');
      if (response.ok) {
        const data = await response.json();
        if (data.markers) {
          // Update existing markers with new values
          setBloodMarkers(prev => prev.map(marker => {
            const newValue = data.markers[marker.id];
            if (newValue !== undefined) {
              return {
                ...marker,
                value: newValue,
                lastUpdated: data.lastUpdated
              };
            }
            return marker;
          }));
        }
      }
    } catch (error) {
      console.error('Error loading blood markers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle parameters extracted from report
  const handleParametersExtracted = (newParameters) => {
    // Update blood markers with extracted values
    setBloodMarkers(prev => prev.map(marker => {
      const extractedParam = newParameters[marker.id];
      if (extractedParam) {
        return {
          ...marker,
          value: extractedParam.value,
          unit: extractedParam.unit,
          status: extractedParam.status || marker.status,
          lastUpdated: new Date().toISOString(),
          source: 'ai_extracted'
        };
      }
      return marker;
    }));
  };

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBloodMarkers();
    setRefreshing(false);
  };

  useEffect(() => {
    loadBloodMarkers();
  }, []);

  // ... existing BodyJam component logic (categorization, formatting, etc.)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button 
            onClick={() => navigate('/')} 
            variant="ghost" 
            className="hover:bg-white/20"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="hover:bg-white/20"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
            🩺 Mihir's Body Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Track your key health metrics and body composition
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        <Tabs defaultValue="blood" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-green-100 border border-green-200">
            <TabsTrigger value="upload" className="data-[state=active]:bg-purple-200">Upload Report</TabsTrigger>
            <TabsTrigger value="blood" className="data-[state=active]:bg-green-200">Blood Markers</TabsTrigger>
            <TabsTrigger value="composition" className="data-[state=active]:bg-green-200">Body Composition</TabsTrigger>
            <TabsTrigger value="macros" className="data-[state=active]:bg-green-200">Maintenance Macros</TabsTrigger>
          </TabsList>
          
          {/* Upload Report Tab */}
          <TabsContent value="upload">
            <BloodReportUploader onParametersExtracted={handleParametersExtracted} />
          </TabsContent>
          
          {/* Blood Markers Tab - existing implementation */}
          <TabsContent value="blood">
            {/* ... existing blood markers display ... */}
          </TabsContent>
          
          {/* Other tabs remain the same */}
          <TabsContent value="composition">
            {/* ... existing body composition ... */}
          </TabsContent>
          
          <TabsContent value="macros">
            {/* ... existing macros ... */}
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>Upload blood reports for automatic parameter extraction</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Upload className="h-4 w-4 text-purple-500" />
              AI-powered extraction
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Updated: {new Date().toLocaleDateString()}</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Live data</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BodyJam;
