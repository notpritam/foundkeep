// These files are copied into the native Share Extension by our config plugin.
// Expo cannot discover those fs.copyFileSync inputs automatically. Include them
// in runtime matching so an OTA cannot assume a newer native share implementation.
module.exports = {
  extraSources: [
    { type: 'dir', filePath: 'share-extension', reasons: ['foundkeepShareExtension'] },
    { type: 'file', filePath: 'assets/images/mark.png', reasons: ['foundkeepShareExtension'] },
  ],
  ignorePaths: ['share-extension/tests/**/*'],
};
