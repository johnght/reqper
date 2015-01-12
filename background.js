//OBJECT
function reptab() {
  //expandible empty object
}
function repeater() {
  //MEMBER VARIABLE
  this.MAX_NUM_TAB = 4;
  this.PERIOD_PER_MIN = 1;//>=1
  this.ALARM= "refresh";
  this.request = {"tabId":null , "url":null, "method":null, "requestBody":null, "requestHeaders":null};
  this.stepone = {"isBeforeRequest":true, "isBeforeSendHeaders":true, "isSendHeaders":true, "isCompleted":false};//prevent mains from being overidden by redirects
  this.reptabs = {};//{tabId:reptab(), ...}
  //MEMBER FUNCTION
  this.isMyTab = function(obj) {
    return (this.reptabs[(obj.tabId).toString()]) ? true : false;
  }
}

//CUSTOM FUNCTION
function closeTab(tid) {
  //unregister the tab
  delete rep.reptabs[tid.toString()];
  chrome.tabs.remove(tid);
}
function openTab() {
  chrome.tabs.create({url:rep.request.url, active:false}, function(tab) {
    //register the tab
    rep.reptabs[(tab.id).toString()] = new reptab();
  });
}
function startRequests() {
  //create loop
  for(var num_tab=0; num_tab<rep.MAX_NUM_TAB; num_tab++) {
    openTab();
  }
  chrome.alarms.create(rep.ALARM, {periodInMinutes: rep.PERIOD_PER_MIN});
}
function noti() {
  new Audio("alert.wav").play();
}
function chrome_alarms_onAlarm(alarm) {
  if(alarm && alarm.name===rep.ALARM) {
    for(var key in rep.reptabs) {
      closeTab(parseInt(key));
    }
    for(var num_tab=0; num_tab<rep.MAX_NUM_TAB; num_tab++) {
      openTab();
    }
  }
}
function chrome_tabs_onReplaced(newId, oldId) {
  rep.reptabs[newId.toString()] = new reptab();
  delete rep.reptabs[oldId.toString()];
}
function chrome_webRequest_onBeforeRequest(obj) {
  //console.log("[onBeforeRequest_" + obj.requestId + "] " + JSON.stringify(obj));
  if(!rep.isMyTab(obj)) {
    if(rep.stepone.isBeforeRequest) {
      rep.stepone.isBeforeRequest = false;
      rep.request.tabId = obj.tabId;
      rep.request.url = obj.url;
      rep.request.method = obj.method;
      rep.request.requestBody = obj.requestBody;
    }
  } else {
    obj.url = rep.request.url;
    obj.method = rep.request.method;
    obj.requestBody = rep.request.requestBody;
  }
}
function chrome_webRequest_onBeforeSendHeaders(obj) {
  //console.log("[onBeforeSendHeaders_" + obj.tabId + "] " + JSON.stringify(obj));
  if(!rep.isMyTab(obj)) {//parent
    if(rep.stepone.isBeforeSendHeaders) {
      rep.stepone.isBeforeSendHeaders = false;
      rep.request.requestHeaders = obj.requestHeaders;
    }
  } else {//main_frame + my tab
    obj.requestHeaders = rep.request.requestHeaders;
  }
}
function chrome_webRequest_onSendHeaders(obj) {
  if(!rep.isMyTab(obj)) {
    if(rep.stepone.isSendHeaders) {
      rep.stepone.isSendHeaders = false;
      startRequests();
    }
  }
}
function chrome_webRequest_onCompleted(obj) {
  if(rep.stepone.isCompleted)
    return;
  if(obj.tabId===rep.request.tabId || rep.isMyTab(obj)) {
  //console.log("[onCompleted] " + JSON.stringify(obj));
    var regex_success = /2\d\d/;
    if(regex_success.test(obj.statusCode)) {
      rep.stepone.isCompleted = true;
      //remove alarm and not-completed tabs
      chrome.alarms.clearAll(function(wasCleared){});
      for(var key in rep.reptabs) {
        if(obj.tabId!==parseInt(key)) {
          chrome.tabs.remove(parseInt(key));
        }
      }
      if(obj.tabId!==rep.request.tabId)
        chrome.tabs.remove(rep.request.tabId);
      noti();
      endrepeater(false);
    }
  }
}
//function chrome_webRequest_onErrorOccurred(obj) {
//  console.log("[onErrorOccurred] " + JSON.stringify(obj));
//}
function startrepeater() {
  chrome.browserAction.setBadgeText({text:"ON"});
  chrome.browserAction.setBadgeBackgroundColor({color:[0,255,0,127]});
  rep = new repeater();
  chrome.alarms.onAlarm.addListener(chrome_alarms_onAlarm);
  chrome.tabs.onReplaced.addListener(chrome_tabs_onReplaced);
  chrome.webRequest.onBeforeRequest.addListener(chrome_webRequest_onBeforeRequest,
    {urls: ["<all_urls>"], types: ["main_frame"]},
    ["requestBody"]
  );
  chrome.webRequest.onBeforeSendHeaders.addListener(chrome_webRequest_onBeforeSendHeaders,
    {urls: ["<all_urls>"], types: ["main_frame"]},
    ["requestHeaders"]
  );
  chrome.webRequest.onSendHeaders.addListener(chrome_webRequest_onSendHeaders,
    {urls: ["<all_urls>"], types: ["main_frame"]}
  );
  chrome.webRequest.onCompleted.addListener(chrome_webRequest_onCompleted,
    {urls: ["<all_urls>"], types: ["main_frame"]}
  );
//  chrome.webRequest.onErrorOccurred.addListener(chrome_webRequest_onErrorOccurred,
//    {urls: ["<all_urls>"], types: ["main_frame"]}
//  );
}
function endrepeater(isAbort) {
  if(isAbort) {
    for(var key in rep.reptabs) {
      chrome.tabs.remove(parseInt(key));
    }
  }
  chrome.browserAction.setBadgeText({text:""});
  chrome.browserAction.setBadgeBackgroundColor({color:[0,0,0,0]});
  chrome.tabs.onReplaced.removeListener(chrome_tabs_onReplaced);
  chrome.webRequest.onBeforeRequest.removeListener(chrome_webRequest_onBeforeRequest);
  chrome.webRequest.onBeforeSendHeaders.removeListener(chrome_webRequest_onBeforeSendHeaders);
  chrome.webRequest.onSendHeaders.removeListener(chrome_webRequest_onSendHeaders);
  chrome.webRequest.onCompleted.removeListener(chrome_webRequest_onCompleted);
  chrome.alarms.clearAll(function(wasCleared){});
  chrome.alarms.onAlarm.removeListener(chrome_alarms_onAlarm);
//  chrome.webRequest.onErrorOccurred.removeListener(chrome_webRequest_onErrorOccurred);
  rep = null;
}

//ENTRANCE
var rep;
chrome.browserAction.onClicked.addListener(function(tab) {
  if(!chrome.tabs.onReplaced.hasListeners())
    startrepeater();
  else
    endrepeater(true);
});