
// Our secret tokens to recognise our messages
const RPC_CALL = '__RPC_CALL__'
const RPC_RESPONSE = '__RPC_RESPONSE__'

export class RpcError extends Error {
	constructor(message) {
		super(message)
		this.name = this.constructor.name
	}
}

export class RemoteError extends Error {
	constructor(message) {
		super(message)
		this.name = this.constructor.name
	}
}


// === Initiating side ===

export function remoteFunction(funcName, { tabId } = {}) {
	const otherSide = (tabId !== undefined)
		? "the tab's content script"
		: 'the background script'

	const f = async function (...args) {
		const message = {
			[RPC_CALL]: RPC_CALL,
			funcName,
			args,
		}

		// Try send the message and await the response.
		let response
		try {
			response = (tabId !== undefined)
				? await browser.tabs.sendMessage(tabId, message)
				: await browser.runtime.sendMessage(message)
		} catch (err) {}

		// Check if we got an error or no response.
		if (response === undefined) {
			throw new RpcError(
				`Got no response when trying to call '${funcName}'. `
				+ `Did you enable RPC in ${otherSide}?`
			)
		}

		// Check if it was *our* listener that responded.
		if (response === null || response[RPC_RESPONSE] !== RPC_RESPONSE) {
			throw new RpcError(
				`RPC got a response from an interfering listener while calling '${funcName}' in `
				+ `${otherSide}`
			)
		}

		// If we could not invoke the function on the other side, throw an error.
		if (response.rpcError) {
			throw new RpcError(response.rpcError)
		}

		// Return the value or throw the error we received from the other side.
		if (response.errorMessage) {
			throw new RemoteError(response.errorMessage)
		} else {
			return response.returnValue
		}
	}

	// Give it a name, could be helpful in debugging
	Object.defineProperty(f, 'name', { value: `${funcName}_RPC` })
	return f
}


// === Executing side ===

const remotelyCallableFunctions = {}

function incomingRPCListener(message, sender) {
	if (message && message[RPC_CALL] === RPC_CALL) {
		const funcName = message.funcName
		const args = message.hasOwnProperty('args') ? message.args : []
		const func = remotelyCallableFunctions[funcName]
		if (func === undefined) {
			console.error(`Received RPC for unknown function: ${funcName}`)
			return Promise.resolve({
				rpcError: `No such function registered for RPC: ${funcName}`,
				[RPC_RESPONSE]: RPC_RESPONSE,
			})
		}
		const extraArg = {
			tab: sender.tab,
		}

		// Run the function
		let returnValue
		try {
			returnValue = func(extraArg, ...args)
		} catch (error) {
			return Promise.resolve({
				errorMessage: error.message,
				[RPC_RESPONSE]: RPC_RESPONSE,
			})
		}
		// Return the function's return value. If it is a promise, first await its result.
		return Promise.resolve(returnValue).then(returnValue => ({
			returnValue,
			[RPC_RESPONSE]: RPC_RESPONSE,
		})).catch(error => ({
			errorMessage: error.message,
			[RPC_RESPONSE]: RPC_RESPONSE,
		}))
	}
}

// A bit of global state to ensure we only attach the event listener once.
let enabled = false

export function makeRemotelyCallable(functions, { insertExtraArg = false } = {}) {
	// Every function is passed an extra argument with sender information,
	// so remove this from the call if this was not desired.
	if (!insertExtraArg) {
		// Replace each func with...
		const wrapFunctions = mapValues(func =>
			// ...a function that calls func, but hides the inserted argument.
			(extraArg, ...args) => func(...args)
		)
		functions = wrapFunctions(functions)
	}

	// Add the functions to our global repetoir.
	Object.assign(remotelyCallableFunctions, functions)

	// Enable the listener if needed.
	if (!enabled) {
		browser.runtime.onMessage.addListener(incomingRPCListener)
		enabled = true
	}
}

const mapValues = fn => object => {
	const result = {}
	for (const [key, value] of Object.entries(object)) {
		result[key] = fn(value)
	}
	return result
}
