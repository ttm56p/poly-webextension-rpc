import test from 'ava'
import { spy } from 'sinon'

import { remoteFunction, RpcError, RemoteError } from '../src/webextension-rpc.js'

test.beforeEach(() => {
	// We mock the browser globally. Note we therefore need to test serially to prevent the tests from
	// interfering with each other.
	global.browser = {
		runtime: {
			sendMessage: spy(async () => {}),
		},
		tabs: {
			sendMessage: spy(async () => {}),
		},
	}
})

test.serial('should create a function', t => {
	const remoteFunc = remoteFunction('remoteFunc', { tabId: 1 })
	t.is(remoteFunc.name, 'remoteFunc_RPC')
	t.is(typeof remoteFunc, 'function')
})

test.serial('should throw an error when unable to sendMessage', async t => {
	const remoteFunc = remoteFunction('remoteFunc', { tabId: 1 })
	browser.tabs.sendMessage = async () => { throw new Error() }
	await t.throwsAsync(remoteFunc, {
		instanceOf: RpcError,
		message: `Got no response when trying to call 'remoteFunc'. Did you enable RPC in the tab's content script?`,
	})
})

test.serial('should call the browser.tabs function when tabId is given', async t => {
	const remoteFunc = remoteFunction('remoteFunc', { tabId: 1 })
	try {
		await remoteFunc()
	} catch (e) {}
	console.log(browser.tabs.sendMessage.callCount)
	t.true(browser.tabs.sendMessage.calledOnce)
	t.true(browser.runtime.sendMessage.notCalled)
})

test.serial('should call the browser.runtime function when tabId is undefined', async t => {
	const remoteFunc = remoteFunction('remoteFunc')
	try {
		await remoteFunc()
	} catch (e) {}
	t.true(browser.tabs.sendMessage.notCalled)
	t.true(browser.runtime.sendMessage.calledOnce)
})

test.serial('should throw an "interfering listener" error if response is unrecognised', async t => {
	browser.tabs.sendMessage = async () => 'some unexpected return value'
	const remoteFunc = remoteFunction('remoteFunc', { tabId: 1 })
	await t.throwsAsync(remoteFunc, {
		instanceOf: RpcError,
		message: /RPC got a response from an interfering listener/,
	})
})

test.serial('should throw a "no response" error if response is undefined', async t => {
	// It seems we can get back undefined when the tab is closed before the response is sent.
	// In such cases 'no response' seems a better error message than 'interfering listener'.
	browser.tabs.sendMessage = async () => undefined
	const remoteFunc = remoteFunction('remoteFunc', { tabId: 1 })
	await t.throwsAsync(remoteFunc, {
		instanceOf: RpcError,
		message: /Got no response/,
	})
})

test.serial('should throw RemoteError if the response contains an error message', async t => {
	browser.tabs.sendMessage = async () => ({
		__RPC_RESPONSE__: '__RPC_RESPONSE__',
		errorMessage: 'Remote function error',
	})
	const remoteFunc = remoteFunction('remoteFunc', { tabId: 1 })
	await t.throwsAsync(remoteFunc, {
		instanceOf: RemoteError,
		message: 'Remote function error',
	})
})

test.serial('should return the value contained in the response', async t => {
	browser.tabs.sendMessage = async () => ({
		__RPC_RESPONSE__: '__RPC_RESPONSE__',
		returnValue: 'Remote function return value',
	})
	const remoteFunc = remoteFunction('remoteFunc', { tabId: 1 })
	t.is(await remoteFunc(), 'Remote function return value')
})

// TODO Test behaviour of executing side.
