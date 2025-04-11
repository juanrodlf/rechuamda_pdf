import React, { useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib"; // Asegúrate de tener pdf-lib instalada

const App = () => {
  const [pdfFiles, setPdfFiles] = useState([]); // Almacena los PDFs disponibles
  const [selectedFiles, setSelectedFiles] = useState([]); // Almacena los PDFs seleccionados para combinar

  useEffect(() => {
    // Cargar los PDFs almacenados en localStorage cuando la app se inicie
    const storedFiles = JSON.parse(localStorage.getItem("pdfFiles")) || [];
    setPdfFiles(storedFiles);
  }, []);

  const handlePdfUpload = (event) => {
    const files = event.target.files;
    const newFiles = [...pdfFiles];

    // Convertir los archivos PDF seleccionados a base64 para almacenarlos
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Pdf = reader.result;
        newFiles.push({ name: file.name, base64: base64Pdf });

        // Actualizar el estado y el localStorage
        setPdfFiles(newFiles);
        localStorage.setItem("pdfFiles", JSON.stringify(newFiles));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSelectFile = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
    setSelectedFiles(selected);
  };

  const handleReorder = (draggedIndex, droppedIndex) => {
    const reorderedFiles = [...selectedFiles];
    const [removed] = reorderedFiles.splice(draggedIndex, 1);
    reorderedFiles.splice(droppedIndex, 0, removed);
    setSelectedFiles(reorderedFiles);
  };

  const handleCreatePdf = async () => {
    // Crear un nuevo PDF combinando los archivos seleccionados
    const pdfDoc = await PDFDocument.create();
    
    for (const file of selectedFiles) {
      const pdfFile = pdfFiles.find((pdf) => pdf.name === file);
      const existingPdfBytes = await fetch(pdfFile.base64).then(res => res.arrayBuffer());
      const existingPdfDoc = await PDFDocument.load(existingPdfBytes);
      const copiedPages = await pdfDoc.copyPages(existingPdfDoc, existingPdfDoc.getPageIndices());
      copiedPages.forEach((page) => pdfDoc.addPage(page));
    }

    // Guardar el nuevo PDF
    const pdfBytes = await pdfDoc.save();
    const newPdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    const newPdfUrl = URL.createObjectURL(newPdfBlob);

    // Crear un enlace para descargar el PDF combinado
    const link = document.createElement("a");
    link.href = newPdfUrl;
    link.download = "combined.pdf";
    link.click();
  };

  return (
    <div>
      <h1>Sube tus PDFs</h1>

      {/* Subir PDFs */}
      <input type="file" accept="application/pdf" onChange={handlePdfUpload} multiple />

      <h2>Selecciona los PDFs para combinar (puedes cambiar el orden):</h2>
      {/* Lista de archivos seleccionados */}
      <ul>
        {selectedFiles.map((file, index) => (
          <li key={index}>
            {file}{" "}
            <button onClick={() => handleReorder(index, index - 1)} disabled={index === 0}>↑</button>
            <button onClick={() => handleReorder(index, index + 1)} disabled={index === selectedFiles.length - 1}>↓</button>
          </li>
        ))}
      </ul>

      {/* Selección de archivos PDF ya almacenados */}
      <select multiple onChange={handleSelectFile}>
        {pdfFiles.map((pdf, index) => (
          <option key={index} value={pdf.name}>
            {pdf.name}
          </option>
        ))}
      </select>

      <button onClick={handleCreatePdf}>Crear PDF combinado</button>

      {selectedFiles.length > 0 && (
        <div>
          <h3>Archivos seleccionados:</h3>
          <ul>
            {selectedFiles.map((file, index) => (
              <li key={index}>{file}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default App;
