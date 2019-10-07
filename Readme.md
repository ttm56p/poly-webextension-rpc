# webextension-rpc

This module provides a *Remote Procedure Call* abstraction around the message passing that is
available to WebExtension (browser extension) scripts. It makes it easier to call a function in the
background script from a tab’s content script, or vice versa.


## Example use

In `background.js`:

    function myFunc(arg) {
      return arg * 2
    }
    makeRemotelyCallable({ myFunc })

In `content_script.js`:

    const myRemoteFunc = remoteFunction('myFunc')
    myRemoteFunc(21).then(result => { ... result is 42! ... })

Note that the remote function always returns a `Promise`, which resolves with the remote function’s
actual return value (if the return value is itself a Promise, its result is awaited too).


## Install

### Using NPM

This module is published [on npm](https://www.npmjs.com/package/webextension-rpc).

Run `npm install webextension-rpc` or equivalent.

### Standalone

Try one of the magic npm bundlers, for example:

`wget https://wzrd.in/standalone/webextension-rpc -O webextension-rpc.js`


## API

### `remoteFunction(functionName, { tabId })`

Create a proxy function that invokes the specified remote function.

- `functionName` (string, required): name of the function as registered on the remote side.
- `options` (object, optional):
    - `tabId` (number): The id of the tab whose content script is the remote side. Leave undefined
      to call the background script (from a content script).

### `makeRemotelyCallable(functions, { insertExtraArg })`

Register one or more functions to enable remote scripts to call them. Arguments:

- `functions` (object, required): An object with a `{ functionName: function }` mapping. Each
  function will be remotely callable using the given name.
- `options` (object, optional):
    - `insertExtraArg` (boolean, default is `false`): If truthy, each executed function also
      receives, as its first argument before the arguments it was invoked with, a [Tab][] object,
      which contains the details of the tab that sent the message.

[Tab]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab
