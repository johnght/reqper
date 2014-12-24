//VARIABLE
var MAX_NUM_TAB = 4, INTERVAL = 1000, TIMEOUT = 60000;
var isInAction = false;
var rep;

//OBJECT
function reptab(tout) {
  this.timeout = tout;
}
function repeater() {
  this.num_tab = 0;
  this.start_intervals = [];
  this.request = {};//{tabId, url, method, requestBody, requestHeaders}
  this.stepone = {isBeforeRequest:true, isBeforeSendHeaders:true, isSendHeaders:true, isCompleted:false};//prevent mains from being overidden by redirects
  this.reptabs = {};//{tabId:reptab(), ...}
}

//CUSTOM FUNCTION
function startrepeater() {
  isInAction = true;
  rep = new repeater();
  chrome.browserAction.setBadgeText({text:"ON"});
  chrome.browserAction.setBadgeBackgroundColor({color:[0,255,0,127]});
}
function endrepeater() {
  isInAction = false;
  rep = null;
  chrome.browserAction.setBadgeText({text:""});
  chrome.browserAction.setBadgeBackgroundColor({color:[0,0,0,0]});
}
function openTab() {
  chrome.tabs.create({url:rep.request.url, active:false}, function(tab) {
    var t = window.setTimeout(function(tid) { closeTab(tid); openTab();},TIMEOUT,tab.id);
    //register the tab
    rep.reptabs[(tab.id).toString()] = new reptab(t);
  });
}
function closeTab(tid) {
  //unregister the tab
  delete rep.reptabs[tid.toString()];
  chrome.tabs.remove(tid);
}
function startRequests() {
  if(rep.num_tab<MAX_NUM_TAB) {
    var t = window.setTimeout(function(){openTab();startRequests()},INTERVAL);
    rep.num_tab++;
    rep.start_intervals.push(t);
  }
}
function isMyTab(obj) {
  return (rep.reptabs[(obj.tabId).toString()]) ? true : false;
}
function noti(){
    new Audio("alert.wav").play();
}

//CHROME API
chrome.browserAction.onClicked.addListener(function(tab) {
  if(!isInAction)
    startrepeater();
  else
    endrepeater();
});
chrome.tabs.onReplaced.addListener(function(newId, oldId) {
  if(!isInAction)
    return;
  var t = rep.reptabs[oldId.toString()].timeout;
  delete rep.reptabs[oldId.toString()];
  rep.reptabs[newId.toString()] = new reptab(t);
});
chrome.webRequest.onBeforeRequest.addListener(function(obj) {
  if(!isInAction)
    return;
//console.log("[onBeforeRequest_" + obj.requestId + "] " + JSON.stringify(obj));
  if(!isMyTab(obj)) {
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
},
{urls: ["<all_urls>"], types: ["main_frame"]},
["requestBody"]
);
chrome.webRequest.onBeforeSendHeaders.addListener(function(obj) {
  if(!isInAction)
    return;
//console.log("[onBeforeSendHeaders_" + obj.tabId + "] " + JSON.stringify(obj));
  if(!isMyTab(obj)) {//parent
    if(rep.stepone.isBeforeSendHeaders) {
      rep.stepone.isBeforeSendHeaders = false;
      rep.request.requestHeaders = obj.requestHeaders;
    }
  } else {//main_frame + my tab
    obj.requestHeaders = rep.request.requestHeaders;
  }
},
{urls: ["<all_urls>"], types: ["main_frame"]},
["requestHeaders"]
);
chrome.webRequest.onSendHeaders.addListener(function(obj) {
  if(!isInAction)
    return;
  if(!isMyTab(obj)) {
    if(rep.stepone.isSendHeaders) {
      rep.stepone.isSendHeaders = false;
      startRequests();
    }
  }
},
{urls: ["<all_urls>"], types: ["main_frame"]}
);
//chrome.webRequest.onErrorOccurred.addListener(function(obj) {
//  if(!isInAction)
//    return;
////console.log("[onErrorOccurred] " + JSON.stringify(obj));
//},
//{urls: ["<all_urls>"], types: ["main_frame"]}
//);
chrome.webRequest.onCompleted.addListener(function(obj) {
  if(!isInAction || rep.stepone.isCompleted)
    return;
  if(obj.tabId===rep.request.tabId || isMyTab(obj)) {
//console.log("[onCompleted] " + JSON.stringify(obj));
    var regex_success = /2\d\d/;
    if(regex_success.test(obj.statusCode)) {
      rep.stepone.isCompleted = true;
      //remove not-started-yet intervals
      for(var i=0; i<rep.start_intervals.length; i++) {
        clearTimeout(rep.start_intervals[i]);
      }
      //remove all timeouts and not-completed tabs
      for(key in rep.reptabs) {
        clearTimeout(rep.reptabs[key].timeout);
        var k = parseInt(key);
        if(obj.tabId!==k)
          chrome.tabs.remove(k);
      }
      if(obj.tabId!==rep.request.tabId)
        chrome.tabs.remove(rep.request.tabId);
      endrepeater();
      //notification
      noti();
    } else {
      //non-successful: do nothing, continues the loop
    }
  }
},
{urls: ["<all_urls>"], types: ["main_frame"]}
);