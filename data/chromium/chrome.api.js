/* Copyright (c) 2012-2015 The TagSpaces Authors. All rights reserved.
 * Use of this source code is governed by a AGPL3 license that
 * can be found in the LICENSE file. */
/* global define, nativeIO, isWin */

define(function(require, exports, module) {
  "use strict";

  console.log("Loading Lite chrome.api.js..");

  // chrome.browserAction.setBadgeBackgroundColor({ color: '#00ff00' });
  // chrome.browserAction.setBadgeText({text: '9999'});

  // changing the name of the app
  $("#logo").text("TagSpaces Lite");

  var TSCORE = require("tscore");
  var TSPOSTIO = require("tspostioapi");
  require("libs/filesaver.js/FileSaver");

  var dataBegin = "<script>addRow(";
  var dataEnd = ");</script>";
  var dataFile = '",0,"';
  var dataDir = '",1,"';


  function getURLParameter(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] == variable) {
        return pair[1];
      }
    }
    return (false);
  }

  function checkAccessFileURLAllowed() {
    chrome.extension.isAllowedFileSchemeAccess(function(isAllowedAccess) {
      if (!isAllowedAccess) {
        TSCORE.showAlertDialog($.i18n.t("ns.dialogs:accessFileURLNotAllowedAlert"));
      }
    });
  };

  function handleStartParameters() {
    var openFile = getURLParameter("openFile");
    if (openFile !== undefined && (openFile.length > 0)) { //  && openFile.indexOf("file://") === 0
      console.log("Opening file in browser: " + openFile);
      openFile = openFile.split("file://")[1];
      //var dirPath = TSCORE.TagUtils.extractContainingDirectoryPath(filePath);
      //TSCORE.IO.listDirectory(dirPath);
      TSCORE.FileOpener.openFileOnStartup(openFile);
    }
  };

  function focusWindow() {
    // Places the TagSpaces window on top of the windows
    window.focus();
  };

  function saveSettings(content) {
    /*chrome.storage.sync.set({'tagSpacesSettings': content}, function() {
        // Notify that we saved.
        message('Settings saved');
    });*/
  };

  function checkNewVersion() {
    console.log("Checking for new version...");
    var cVer = TSCORE.Config.DefaultSettings.appVersion + "." + TSCORE.Config.DefaultSettings.appBuild;
    $.ajax({
        url: 'http://tagspaces.org/releases/version.json?cVer=' + cVer,
        type: 'GET'
      })
      .done(function(data) {
        TSPOSTIO.checkNewVersion(data);
      })
      .fail(function(data) {
        console.log("AJAX failed " + data);
      });
  };


  function createDirectoryIndex(dirPath) {
    TSCORE.showWaitingDialog($.i18n.t("ns.common:waitDialogDiectoryIndexing"));

    var directoryIndex = [];
    TSCORE.Utils.walkDirectory(dirPath, {recursive: true}, function(fileEntry) {
      directoryIndex.push(fileEntry);
    }).then(
      function(entries) {
        TSPOSTIO.createDirectoryIndex(directoryIndex);
      },
      function(err) {
        console.warn("Error creating index: " + err);
      }
    ).catch(function() {
      TSCORE.hideWaitingDialog();
    });
  };

  function createDirectoryTree(dirPath) {
    TSCORE.showLoadingAnimation();
    console.log("Creating directory not supported: " + dirPath);
    //var directoyTree = generateDirectoryTree(dirPath);
    //console.log(JSON.stringify(directoyTree));
    //TSPOSTIO.createDirectoryTree(directoyTree);
  };


  function listDirectoryPromise(dirPath) {
    console.log("Listing directory: " + dirPath);
    return new Promise(function(resolve, reject) {
      var anotatedDirList = [];
      $.ajax({
          url: "file://" + dirPath,
          type: 'GET'
        })
        .done(function(data) {
          //console.log("Dir List "+data);
          var folders = data.substring(data.indexOf(dataBegin) + dataBegin.length, data.lastIndexOf(dataEnd));
          folders = folders.split(dataBegin).join("");
          folders = folders.split(dataEnd);

          var name,
            path,
            isFile,
            fileSize,
            lastDateModified,
            fileProp;

          anotatedDirList = [];
          // sciping the first entry pointing to the parent directory
          for (var i = 1; i < folders.length; i++) {
            console.log("Dir " + folders[i]);
            name = folders[i].substring(2, folders[i].indexOf('","'));
            path = dirPath + TSCORE.dirSeparator + name;
            isFile = (folders[i].indexOf(dataFile) > 1);
            fileSize = 0;
            lastDateModified = 0;
            if (isFile) {
              fileProp = folders[i].substring(folders[i].indexOf(dataFile) + dataFile.length + 1, folders[i].length - 1);
              fileProp = fileProp.split('","');
              fileSize = fileProp[0];
              lastDateModified = fileProp[1];
            }
            anotatedDirList.push({
              "name": name,
              "isFile": isFile,
              "size": fileSize,
              "lmdt": lastDateModified,
              "path": path
            });
          }
          resolve(anotatedDirList);
        }).fail(function(error) {
          console.warn("Error listing files" + JSON.stringify(error));
          reject(error);
        });
    });
  }

  function listDirectory(dirPath, resultCallback) {
    TSCORE.showLoadingAnimation();
    listDirectoryPromise(dirPath).then(function(anotatedDirList) {
        if (resultCallback) {
          resultCallback(anotatedDirList);
        } else {
          TSPOSTIO.listDirectory(anotatedDirList);
        }
      }, function(error) {
        if (resultCallback) {
          resultCallback();
        } else {
          TSPOSTIO.errorOpeningPath(dirPath);
        }
        TSCORE.hideLoadingAnimation();
        console.error("Error listDirectory " + dirPath + " error: " + error);
      }
    );
  };

  function getDirectoryMetaInformation(dirPath, readyCallback) {
    listDirectory(dirPath, function(anotatedDirList) {
      TSCORE.metaFileList = anotatedDirList;
      readyCallback(anotatedDirList);
    });
  };

  function listSubDirectories(dirPath) {
    console.log("Listing sub directories: " + dirPath);
    TSCORE.showLoadingAnimation();
    listDirectoryPromise(dirPath).then(function(entries) {
      var anotatedDirList = [];
      // skiping the first entry pointing to the parent directory
      for (var i = 1; i < entries.length; i++) {
        if (!entries[i].isFile) {
          anotatedDirList.push({
            "name": entries[i].name,
            "path": entries[i].path
          });
        }
      }
      TSPOSTIO.listSubDirectories(anotatedDirList, dirPath);
    }, function(error) {
      TSPOSTIO.errorOpeningPath(dirPath);
      TSCORE.hideLoadingAnimation();
      console.error("Error listDirectory " + dirPath + " error: " + error);
    });
  };


  function getPropertiesPromise(filePath) {
    return new Promise(function(resolve, reject) {
      // TODO use listDirectory to get size and lmdt
      var fileProperties = {};
      fileProperties.path = filePath;
      fileProperties.size = 0;
      fileProperties.lmdt = 0;
      resolve(fileProperties);
    });
  };

  function getFileProperties(filePath) {
    getPropertiesPromise().then(function(fileProperties) {
      TSPOSTIO.getFileProperties(fileProperties);
    }, function(err) {
      TSCORE.showAlertDialog("Could not get properties for: " + filePath);
    })
  };


  function loadTextFile(filePath) {
    console.log("Loading file: " + filePath);
    getFileContentPromise(filePath, "text").then(function(data) {
        TSPOSTIO.loadTextFile(data);
      }, function(error) {
        TSCORE.hideLoadingAnimation();
        console.error("loading text file failed " + data);
      }
    );
  };

  function getFileContent(fullPath, result, error) {
    // TODO 4remove
    getFileContentPromise(fullPath).then(result, error);
  }

  function getFileContentPromise(fullPath, type) {
    console.log("getFileContentPromise: " + fullPath);
    return new Promise(function(resolve, reject) {
      var fileURL = fullPath;
      if (fileURL.indexOf("file://") === -1) {
        fileURL = "file://" + fileURL;
      }
      var xhr = new XMLHttpRequest();
      xhr.open("GET", fileURL, true);
      xhr.responseType = type || "arraybuffer";
      xhr.onerror = reject;

      xhr.onload = function() {
        var response = xhr.response || xhr.responseText;
        if (response) {
          resolve(response);
        } else {
          reject("getFileContentPromise error");
        }
      };
      xhr.send();
    });
  }


  function saveFilePromise(filePath, content, mode) {
    console.log("Saving binary file: " + filePath);
    return new Promise(function(resolve, reject){
      var blob = new Blob([content], {
        type: "text/plain;charset=utf-8"
      });
      saveAs(blob, TSCORE.TagUtils.extractFileName(filePath));
      resolve();
    });
  }

  function saveTextFile(filePath, content) {
    TSCORE.showLoadingAnimation();
    console.log("Saving file: " + filePath);
    saveFilePromise(filePath).then(function() {
        // TODO close file after save
        //TSPOSTIO.saveTextFile(filePath);
      }, function(error) {
        TSCORE.showAlertDialog("Save text file " + filePath + "filed");
        console.error(error);
      }
    );
  };

  function saveBinaryFile(filePath, content) {
    TSCORE.showLoadingAnimation();
    console.log("Saving binary file: " + filePath);
    saveFilePromise(filePath).then(function() {
        // TODO close file after save
        //TSPOSTIO.saveTextFile(filePath);
      }, function(error) {
        TSCORE.showAlertDialog("Save binary file " + filePath + "filed");
        console.error(error);
      }
    );
  };


  function createDirectoryPromise(dirPath) {
    return new Promise(function(res, rej) {
      TSCORE.showAlertDialog("Creating directory is not supported in Chrome, please use the desktop version.");
      res(true);
    });
  };

  function createDirectory(dirPath) {
    // TODO 4 remove
    createDirectoryPromise();
  };


  function renameDirectoryPromise() {
    return new Promise(function(res, rej) {
      TSCORE.showAlertDialog("Renaming directory is not supported in Chrome, please use the desktop version.");
      res(true);
    });
  };

  function renameDirectory() {
    // TODO 4remove
    renameDirectoryPromise();
  };


  function renameFilePromise() {
    return new Promise(function(res, rej) {
      TSCORE.showAlertDialog("Renaming file is not supported in Chrome, please use the desktop version.");
      res(true);
    });
  };

  function renameFile() {
    // TODO 4remove
    renameFilePromise();
  };


  function copyFilePromise() {
    return new Promise(function(res, rej) {
      TSCORE.showAlertDialog("Copy file is not supported in Chrome, please use the desktop version.");
      res(true);
    });
  };

  function copyFile() {
    // TODO 4remove
    copyFilePromise();
  };


  function deleteFilePromise() {
    return new Promise(function(res, rej) {
      TSCORE.showAlertDialog("Creating directory is not supported in Chrome, please use the desktop version.");
      res(true);
    });
  };

  function deleteElement() {
    // TODO 4remove
    deleteDirectoryPromise();
  };


  function deleteDirectoryPromise() {
    return new Promise(function(res, rej) {
      TSCORE.showAlertDialog("Deleting directory is not supported in Chrome, please use the desktop version.");
      res(true);
    });
  };

  function deleteDirectory() {
    // TODO 4remove
    deleteDirectoryPromise();
  };


  function selectDirectory() {
    console.log("Select directory!");
    var rootPath = "/";
    if (isWin) {
      rootPath = "C:";
    }
    TSCORE.showDirectoryBrowserDialog(rootPath);
  };

  function selectFile() {
    // TODO
    TSCORE.showAlertDialog("Select file not implemented!");
  };


  function openDirectory(dirPath) {
    // TODO
    TSCORE.showAlertDialog($.i18n.t("ns.dialogs:openContainingDirectoryAlert"));
  };

  function openFile(filePath) {
    // TODO
    TSCORE.showAlertDialog($.i18n.t("ns.dialogs:openFileNativelyAlert"));
  };

  exports.handleStartParameters = handleStartParameters;
  exports.checkAccessFileURLAllowed = checkAccessFileURLAllowed;
  exports.focusWindow = focusWindow;
  exports.saveSettings = saveSettings;
  exports.checkNewVersion = checkNewVersion;

  exports.createDirectoryIndex = createDirectoryIndex;
  exports.createDirectoryTree = createDirectoryTree;

  exports.listDirectoryPromise = listDirectoryPromise;
  exports.listDirectory = listDirectory; /** @deprecated */
  exports.listSubDirectories = listSubDirectories; /** TODO move in ioutils */
  exports.getDirectoryMetaInformation = getDirectoryMetaInformation; /** @deprecated */

  exports.getPropertiesPromise = getPropertiesPromise;
  exports.getFileProperties = getFileProperties; /** @deprecated */

  exports.createDirectoryPromise = createDirectoryPromise;
  exports.createDirectory = createDirectory; /** @deprecated */

  exports.getFileContentPromise = getFileContentPromise;
  exports.loadTextFile = loadTextFile; /** @deprecated */
  exports.getFileContent = getFileContent; /** @deprecated */

  exports.saveFilePromise = saveFilePromise;
  exports.saveTextFile = saveTextFile; /** @deprecated */
  exports.saveBinaryFile = saveBinaryFile; /** @deprecated */

  exports.copyFilePromise = copyFilePromise;
  exports.copyFile = copyFile; /** @deprecated */

  exports.renameFilePromise = renameFilePromise;
  exports.renameFile = renameFile; /** @deprecated */

  exports.renameDirectoryPromise = renameDirectoryPromise;
  exports.renameDirectory = renameDirectory; /** @deprecated */

  exports.deleteFilePromise = deleteFilePromise;
  exports.deleteElement = deleteElement; /** @deprecated */

  exports.deleteDirectoryPromise = deleteDirectoryPromise;
  exports.deleteDirectory = deleteDirectory; /** @deprecated */

  exports.selectFile = selectFile;
  exports.selectDirectory = selectDirectory;

  exports.openDirectory = openDirectory;
  exports.openFile = openFile;

});
