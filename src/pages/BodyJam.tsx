import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Activity, Info, Scale, Heart, Dumbbell, Flame, Apple, Droplet, Upload, RefreshCw, FileText, Loader2, Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from 'sonner';

// =============================================================================
// BLOOD REPORT UPLOADER COMPONENT - FIXED VERSION
// =============================================================================

// Fixed BloodReportUploader component - only the handleUpload function needs to be updated

const BloodReportUploader = ({ onParametersExtracted }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  // Handle file selection - WORKING VERSION
  const handleFileSelect = useCallback((event) => {
    const selectedFile = event.target.files[0];
    console.log('📄 File selected:', selectedFile);
    
    if (selectedFile) {
      console.log('📄 File details:', {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      });

      // Accept both PDF and text files for testing
      const validTypes = ['application/pdf', 'text/plain'];
      
      if (validTypes.includes(selectedFile.type)) {
        if (selectedFile.size <= 10 * 1024 * 1024) { // 10MB limit
          setFile(selectedFile);
          setExtractedData(null);
          console.log('✅ File accepted');
        } else {
          toast.error('File size must be less than 10MB');
        }
      } else {
        toast.error('Please upload a PDF or TXT file');
      }
    } else {
      console.log('❌ No file selected');
    }
  }, []);

  // Handle drag and drop - WORKING VERSION
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    console.log('🎯 File dropped:', droppedFile);
    
    if (droppedFile) {
      const validTypes = ['application/pdf', 'text/plain'];
      if (validTypes.includes(droppedFile.type)) {
        setFile(droppedFile);
        setExtractedData(null);
        console.log('✅ Dropped file accepted');
      } else {
        toast.error('Please upload a PDF or TXT file');
      }
    }
  }, []);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
  }, []);

  // FIXED Upload and process file
  const handleUpload = async () => {
    if (!file) {
      console.log('❌ No file to upload');
      toast.error('Please select a file first');
      return;
    }

    console.log('🚀 Starting upload process with file:', file.name);
    setUploading(true);
    setProcessing(true);

    try {
      // Create FormData - CRITICAL PART
      const formData = new FormData();
      
      console.log('📦 Creating FormData...');
      formData.append('file', file);
      formData.append('userId', 'mihir_jain');
      
      // Debug: Log FormData contents
      console.log('📦 FormData created with:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }

      console.log('📤 Uploading to /api/blood-report/upload...');

      // Upload file
      const uploadResponse = await fetch('/api/blood-report/upload', {
        method: 'POST',
        body: formData
        // DO NOT set Content-Type header - let browser set it
      });

      console.log('📤 Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed:', errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('✅ Upload successful:', uploadResult);
      toast.success('File uploaded successfully');

      setUploading(false);

      // FIXED: Process file with AI - now passing filePath
      console.log('🔄 Starting processing with filePath:', uploadResult.filePath);
      const processResponse = await fetch('/api/blood-report/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: uploadResult.fileId,
          userId: 'mihir_jain',
          filePath: uploadResult.filePath  // THIS IS THE FIX - pass the filePath
        })
      });

      console.log('🔄 Process response status:', processResponse.status);

      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        console.error('❌ Processing failed:', errorText);
        throw new Error(`Processing failed: ${processResponse.status} - ${errorText}`);
      }

      const processResult = await processResponse.json();
      console.log('✅ Processing successful:', processResult);
      setExtractedData(processResult);
      toast.success('Blood parameters extracted successfully');

    } catch (error) {
      console.error('❌ Upload/processing error:', error);
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
            Upload your blood test report (PDF or TXT) and we'll automatically extract all parameters
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
                or click to browse files (PDF or TXT)
              </p>
              <input
                type="file"
                accept=".pdf,.txt,text/plain,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button className="bg-purple-600 hover:bg-purple-700" asChild>
                  <span>Choose File</span>
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
                      {(file.size / 1024 / 1024).toFixed(2)} MB - {file.type}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setExtractedData(null);
                    }}
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

      {/* Debug Info */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-sm">Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs space-y-1">
            <div>File selected: {file ? file.name : 'None'}</div>
            <div>File type: {file ? file.type : 'N/A'}</div>
            <div>File size: {file ? `${(file.size / 1024).toFixed(1)} KB` : 'N/A'}</div>
            <div>Uploading: {uploading ? 'Yes' : 'No'}</div>
            <div>Processing: {processing ? 'Yes' : 'No'}</div>
          </div>
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
// MAIN BODYJAM COMPONENT
// =============================================================================

const BodyJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Blood marker data - will be updated from uploads
  const [bloodMarkers, setBloodMarkers] = useState([
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
    {
      id: "hemoglobin",
      name: "Hemoglobin",
      value: 16.3,
      unit: "g/dL",
      normalRange: "13.5-17.5 g/dL (men); 12.0-15.5 (women)",
      explanation: "Iron-rich protein in red blood cells that carries oxygen",
      status: "good",
      category: "blood"
    },
    {
      id: "wbc",
      name: "WBC",
      value: 5560,
      unit: "cells/mm³",
      normalRange: "4,500-11,000 cells/mcL",
      explanation: "White blood cells that fight infections and diseases",
      status: "good",
      category: "blood"
    },
    {
      id: "platelets",
      name: "Platelet Count",
      value: 309,
      unit: "10³/µL",
      normalRange: "150,000-450,000 platelets/mcL",
      explanation: "Blood cells that help with clotting and wound healing",
      status: "good",
      category: "blood"
    },
    {
      id: "hdl",
      name: "HDL Cholesterol",
      value: 38,
      unit: "mg/dL",
      normalRange: "40 mg/dL or higher (men); 50 or higher (women)",
      explanation: "Good cholesterol that helps remove other forms of cholesterol",
      status: "attention",
      category: "lipids"
    },
    {
      id: "ldl",
      name: "LDL Cholesterol",
      value: 96,
      unit: "mg/dL",
      normalRange: "Less than 100 mg/dL",
      explanation: "Bad cholesterol that can build up in arteries",
      status: "good",
      category: "lipids"
    },
    {
      id: "total_cholesterol",
      name: "Total Cholesterol",
      value: 144,
      unit: "mg/dL",
      normalRange: "Less than 200 mg/dL",
      explanation: "Total amount of cholesterol in your blood",
      status: "good",
      category: "lipids"
    },
    {
      id: "triglycerides",
      name: "Triglycerides",
      value: 50,
      unit: "mg/dL",
      normalRange: "Less than 150 mg/dL",
      explanation: "Type of fat found in blood, high levels increase heart disease risk",
      status: "good",
      category: "lipids"
    },
    {
      id: "glucose",
      name: "Glucose (Random)",
      value: 89,
      unit: "mg/dL",
      normalRange: "70-140 mg/dL (random); 70-99 mg/dL (fasting)",
      explanation: "Blood sugar level, important for diabetes screening",
      status: "good",
      category: "metabolic"
    },
    {
      id: "hba1c",
      name: "HbA1C",
      value: 5.1,
      unit: "%",
      normalRange: "Below 5.7%",
      explanation: "Average blood sugar over 2-3 months",
      status: "good",
      category: "metabolic"
    },
    {
      id: "creatinine",
      name: "Creatinine",
      value: 0.7,
      unit: "mg/dL",
      normalRange: "0.7-1.3 mg/dL (men); 0.6-1.1 mg/dL (women)",
      explanation: "Waste product filtered by kidneys, indicates kidney function",
      status: "good",
      category: "kidney"
    },
    {
      id: "calcium",
      name: "Calcium",
      value: 9.3,
      unit: "mg/dL",
      normalRange: "8.5-10.5 mg/dL",
      explanation: "Essential mineral for bones, teeth, and muscle function",
      status: "good",
      category: "minerals"
    },
    {
      id: "sodium",
      name: "Sodium",
      value: 134,
      unit: "mmol/L",
      normalRange: "135-145 mmol/L",
      explanation: "Electrolyte that helps regulate fluid balance",
      status: "attention",
      category: "electrolytes"
    },
    {
      id: "potassium",
      name: "Potassium",
      value: 4.8,
      unit: "mmol/L",
      normalRange: "3.5-5.0 mmol/L",
      explanation: "Essential for heart rhythm and muscle function",
      status: "good",
      category: "electrolytes"
    },
    {
      id: "vitamin_b12",
      name: "Vitamin B12",
      value: 405,
      unit: "pg/mL",
      normalRange: "200-900 pg/mL",
      explanation: "Essential for nerve function and red blood cell formation",
      status: "good",
      category: "vitamins"
    },
    {
      id: "vitamin_d",
      name: "Vitamin D",
      value: 48.2,
      unit: "ng/mL",
      normalRange: "20-50 ng/mL",
      explanation: "Important for bone health and immune function",
      status: "good",
      category: "vitamins"
    },
    {
      id: "tsh",
      name: "TSH",
      value: 2.504,
      unit: "µIU/mL",
      normalRange: "0.4-4.0 µIU/mL",
      explanation: "Thyroid stimulating hormone, regulates metabolism",
      status: "good",
      category: "hormones"
    },
    {
      id: "uric_acid",
      name: "Uric Acid",
      value: 4.4,
      unit: "mg/dL",
      normalRange: "3.5-7.2 mg/dL (men); 2.5-6.0 mg/dL (women)",
      explanation: "Waste product, high levels can cause gout",
      status: "good",
      category: "metabolic"
    }
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
      const extractedValue = newParameters[marker.id];
      if (extractedValue !== undefined) {
        return {
          ...marker,
          value: extractedValue,
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

  // Categorize blood markers
  const categorizedMarkers = bloodMarkers.reduce((acc, marker) => {
    if (!acc[marker.category]) {
      acc[marker.category] = [];
    }
    acc[marker.category].push(marker);
    return acc;
  }, {});

  // Format value display
  const formatValue = (value, unit) => {
    if (typeof value === 'number') {
      return value % 1 === 0 ? value.toString() : value.toFixed(1);
    }
    return value;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'attention': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'blood': return <Droplet className="h-5 w-5" />;
      case 'lipids': return <Heart className="h-5 w-5" />;
      case 'metabolic': return <Activity className="h-5 w-5" />;
      case 'kidney': return <Activity className="h-5 w-5" />;
      case 'minerals': return <Scale className="h-5 w-5" />;
      case 'electrolytes': return <Activity className="h-5 w-5" />;
      case 'vitamins': return <Apple className="h-5 w-5" />;
      case 'hormones': return <Activity className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

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
          
          {/* Blood Markers Tab */}
          <TabsContent value="blood">
            <div className="space-y-8">
              {Object.entries(categorizedMarkers).map(([category, markers]) => (
                <Card key={category} className="bg-white/60 backdrop-blur-sm border-gray-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 capitalize">
                      {getCategoryIcon(category)}
                      {category} Markers
                      <Badge variant="secondary">{markers.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {markers.map((marker) => (
                        <Card key={marker.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-gray-800">{marker.name}</h4>
                              <Badge className={getStatusColor(marker.status)}>
                                {marker.status}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="text-2xl font-bold text-gray-900">
                                {formatValue(marker.value, marker.unit)} 
                                <span className="text-sm font-normal text-gray-500 ml-1">
                                  {marker.unit}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Normal: {marker.normalRange}
                              </div>
                              <div className="text-xs text-gray-600 leading-relaxed">
                                {marker.explanation}
                              </div>
                              {marker.lastUpdated && (
                                <div className="text-xs text-blue-600">
                                  Updated: {new Date(marker.lastUpdated).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          {/* Body Composition Tab */}
          <TabsContent value="composition">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-white/60 backdrop-blur-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-blue-600" />
                    Body Composition
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium">Weight</span>
                      <span className="text-xl font-bold">70 kg</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium">Body Fat</span>
                      <span className="text-xl font-bold">12%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <span className="font-medium">Muscle Mass</span>
                      <span className="text-xl font-bold">61.6 kg</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <span className="font-medium">BMI</span>
                      <span className="text-xl font-bold">22.4</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/60 backdrop-blur-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Fitness Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="font-medium">Resting Heart Rate</span>
                      <span className="text-xl font-bold">58 bpm</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium">VO2 Max</span>
                      <span className="text-xl font-bold">52 ml/kg/min</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium">Body Water</span>
                      <span className="text-xl font-bold">62%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <span className="font-medium">Bone Mass</span>
                      <span className="text-xl font-bold">3.2 kg</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Maintenance Macros Tab */}
          <TabsContent value="macros">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-white/60 backdrop-blur-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-600" />
                    Daily Calorie Targets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-orange-50 rounded-lg">
                      <div className="text-3xl font-bold text-orange-600 mb-2">2,847</div>
                      <div className="text-gray-600">Maintenance Calories</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">2,562</div>
                        <div className="text-sm text-gray-600">Cut (-10%)</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-600">2,847</div>
                        <div className="text-sm text-gray-600">Maintain</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-xl font-bold text-purple-600">3,132</div>
                        <div className="text-sm text-gray-600">Bulk (+10%)</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/60 backdrop-blur-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="h-5 w-5 text-green-600" />
                    Macro Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="font-medium">Protein (30%)</span>
                      <span className="text-xl font-bold">214g</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium">Carbs (40%)</span>
                      <span className="text-xl font-bold">285g</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <span className="font-medium">Fats (30%)</span>
                      <span className="text-xl font-bold">95g</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-4">
                      Based on: 70kg body weight, moderate activity level, body composition goals
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Level Explanation */}
            <Card className="bg-white/60 backdrop-blur-sm border-gray-200 mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-blue-600" />
                  Activity Level & Training
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Strength Training</h4>
                    <p className="text-sm text-gray-600">4-5 sessions per week</p>
                    <p className="text-sm text-gray-600">Compound movements focus</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">Cardio</h4>
                    <p className="text-sm text-gray-600">2-3 moderate sessions</p>
                    <p className="text-sm text-gray-600">Zone 2 heart rate</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-800 mb-2">Recovery</h4>
                    <p className="text-sm text-gray-600">8+ hours sleep</p>
                    <p className="text-sm text-gray-600">Active rest days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
