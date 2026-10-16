const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
    openFiles: (filters) => ipcRenderer.invoke('dialog:open-files', filters),
    saveZip: (defaultName) => ipcRenderer.invoke('dialog:save-zip', defaultName),
    inspectImage: (imagePath) => ipcRenderer.invoke('pack:inspect-image', imagePath),
    fixImage: (inputPath, outputPath) => ipcRenderer.invoke('pack:fix-image', { inputPath, outputPath }),
    validatePack: (packDir) => ipcRenderer.invoke('pack:validate', packDir),
    scanDirectoryImages: (dirPath) => ipcRenderer.invoke('pack:scan-directory-images', dirPath),
    generatePack: (packData) => ipcRenderer.invoke('pack:generate', packData),
    createZip: (sourceDir, outputZip) => ipcRenderer.invoke('pack:create-zip', { sourceDir, outputZip }),
    uploadCloud: (filePath, provider) => ipcRenderer.invoke('pack:upload-cloud', { filePath, provider }),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    getStats: () => ipcRenderer.invoke('app:get-stats')
});
