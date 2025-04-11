import React, { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function App() {
  const [files, setFiles] = useState([]);
  const [orderedFiles, setOrderedFiles] = useState([]);
  const [mergedPdfUrl, setMergedPdfUrl] = useState(null);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(newFiles);
    setOrderedFiles(newFiles);
  };

  const moveFile = (index, direction) => {
    const newOrder = [...orderedFiles];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(index + direction, 0, moved);
    setOrderedFiles(newOrder);
  };

  const mergePdfs = async () => {
    const mergedPdf = await PDFDocument.create();

    for (const file of orderedFiles) {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: "application/pdf" });
    setMergedPdfUrl(URL.createObjectURL(blob));
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50 text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Combinar PDFs</h1>
      <input type="file" multiple accept="application/pdf" onChange={handleFileChange} className="mb-4" />

      {orderedFiles.length > 0 && (
        <div className="grid gap-2 mb-4">
          {orderedFiles.map((file, index) => (
            <Card key={index} className="flex justify-between items-center p-2">
              <CardContent className="flex-grow">{file.name}</CardContent>
              <div className="flex gap-2">
                <Button onClick={() => moveFile(index, -1)} disabled={index === 0}>
                  🔼
                </Button>
                <Button onClick={() => moveFile(index, 1)} disabled={index === orderedFiles.length - 1}>
                  🔽
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button onClick={mergePdfs} disabled={orderedFiles.length < 2} className="mb-4">
        Combinar PDFs
      </Button>

      {mergedPdfUrl && (
        <div>
          <a href={mergedPdfUrl} download="combinado.pdf" className="text-blue-600 underline">
            Descargar PDF Combinado
          </a>
        </div>
      )}
    </div>
  );
}
