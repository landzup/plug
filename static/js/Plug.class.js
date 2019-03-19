/*
	Plug framework 1.2 (c) 2005
	* http://plugframe.com/
	* Released under the MIT license
	* http://opensource.org/licenses/MIT
*/
"use strict";

// the framework super-object used as namespace
var plug = plug || {};

(function() {
	var _config = {
		context: window, // defines the namespace for the Class constructor
		trace: 'ALL', // ('ALL'|'SINGLETON'|false)
		/*
			'ALL': allows the implementation to track all the defined classes
			'SINGLETON': tracks only singleton Classes
			false: does not track at all
			In any case, regitered constructors requires to be manually deleted to free memory (that is making them eligible for garbage collection)
		*/
		unregister: 'CLASS_INSTANCES' // ('ALL'|'CLASSES_ONLY'|'ALL_INSTANCES'|'CLASS_INSTANCES')
		/*
			'ALL': allows to delete from the register all constructors (both classes and singletons) and their instances;
			'CLASSES_ONLY': allows to delete from the register only classes and their instances;
			'ALL_INSTANCES': allows to delete from the register all the instances of classes and singletons;
			'CLASS_INSTANCES': allows to delete from the register only class instances;
			false: does not allow to delete any instance;
		*/
	};
	
	var _register = []; // a specialized array containing constructors and instances, extended with proper methods to manage its items;
	/** Sample structure of the _register array:
		[
			{
				constructor: c1,
				prototype: null,
				instances: [i1, i2, i3],
				isSingleton: false,
				status: (IDLE|CONSTRUCTING|REFLECTING),
				protectedProps: {}
			},
			{
				constructor: c2,
				prototype: null,
				instances: [i4],
				isSingleton: true,
				status: (IDLE|CONSTRUCTING|REFLECTING),
				protectedProps: {}
			}
		]
	**/
	
	_register.trace = function(Constructor, instance, isSingleton) {
		// this method pushes inside the private '_register' array an object containing a singleton constructor and, if given, its instance
		var trace = _register.getTrace(Constructor);
		
		if (trace === false) {
			_register.push({
				constructor: Constructor,
				prototype: null,
				instances: typeof(instance) === 'undefined' || instance === null ? [] : [instance], // array of instances
				isSingleton: typeof(isSingleton) === 'undefined' ? false : isSingleton,
				status: 'IDLE', // constructor status, possible values: IDLE|EXTENDING|REFLECTING
				protectedProps: {} // protected members to be inherited
			});
		} else if (instance !== null && (trace.instances.length === 0 || !trace.isSingleton)) {
			trace.instances.push(instance);
		}
	};
	_register.getTrace = function(Constructor) {
		// this method returns the object in the _register array containing the constructor and its instance, given the constructor;
		var regLength = _register.length,
			i;
		
		for (i = 0; i < regLength; ++i) {
			if (_register[i].constructor === Constructor) {
				return _register[i];
			}
		}
		return false;
	};
	_register.getInstancesByConstructor = function(Constructor) {
		// this method returns an array containing all the instances of a given constructor
		var trace = _register.getTrace(Constructor);
		
		if (trace !== false) {
			return trace.instances;
		}
		return false;
	};
	_register.isSingleton = function(Constructor) {
		// this method checks if the given constructor is a singleton class
		var trace = _register.getTrace(Constructor);
		
		if (trace && typeof(trace.isSingleton) !== null) {
			return trace.isSingleton;
		}
		return false;
	};
	_register.setStatus = function(Constructor, status) {
		// this method sets the status of the given constructor
		var trace = _register.getTrace(Constructor);
		
		if (trace !== false) {
			trace.status = status;
			return true;
		}
		return false;
	};
	_register.getStatus = function(Constructor) {
		// this method gets the status of the given constructor
		var trace = _register.getTrace(Constructor);
		
		if (trace !== false) {
			return trace.status;
		}
		return false;
	};
	_register.getProtected = function(Constructor) {
		// this method gets the object containing the protected properties of the given constructor
		var trace = _register.getTrace(Constructor);
		
		if (trace !== false) {
			return trace.protectedProps;
		}
		return false;
	};
	_register.getRegisteredClasses = function() {
		// this method returns an array of the defined classes
		var classes = [],
			regLength = _register.length,
			i;
		
		for (i = 0; i < regLength; ++i) {
			classes.push(_register[i].constructor);
		}
		return classes;
	};
	_register.unregister = function(Constructor) {
		var regLength = _register.length,
			i;
		
		for (i = 0; i < regLength; ++i) {
			var trace = _register[i];
			
			if (trace.constructor === Constructor) {
				if (_config.unregister === 'ALL' || (_config.unregister === 'CLASSES_ONLY' && !trace.isSingleton)) {
					// delete the whole trace (constructor and its instances) for the allowed super-constructors (classes or singletons):
					delete trace.constructor;
					delete trace.instances;
					delete trace.isSingleton;
					delete trace.status;
					delete trace.protectedProps;
					_register.splice(i, 1);
				} else if (_config.unregister === 'ALL_INSTANCES' || (_config.unregister === 'CLASS_INSTANCES' && !trace.isSingleton)) {
					// keep references of the constructors and delete only erasable instances:
					trace.instances = [];
				} else {
					return false;
				}
				return true;
			}
		}
		return false;
	};
	
	/**
		Class and Singleton super-constructors:
		they work both as a constructor or function,
		returning an extensible class from the contructor given as argument;
		if no argument is given, it will be returned the super-constructor itself;
	**/
	var Class = function Class(Constructor) {
		return build(Class, Constructor);
	};
	
	var Singleton = function Singleton(Constructor) {
		return build(Singleton, Constructor);
	};
	
	// a delegate function of Class and Singleton super-constructors to build constructors:
	var build = function build(Super, Constructor) {
		if (_register.getStatus(Super) !== 'EXTENDING') {
			if (Constructor === undefined) {
				// no argument received, return itself as super-constructor:
				var NewClass = Super;
			} else if (typeof(Constructor) === 'function') {
				// Class it's being invoked as a constructor and the argument is valid:
				if (Super === Singleton && !/^(ALL|SINGLETON)$/.test(_config.trace)) {
					throw new Error('Singleton not allowed by configuration settings');
				}
				var NewClass = extend(false, Constructor, Super === Singleton);
			} else {
				// invalid argument received, throw an error:
				throw new Error((Super === Singleton ? 'Singleton' : 'Class') + ' argument must be a constructor');
			}
			return NewClass;
		}
	};
	
	// private function to allow reflection both for Class and Singleton constructors:
	var construct = function construct(Constructor, args) {
		_register.setStatus(Constructor, 'REFLECTING');
		var instance = new Constructor(args);
		_register.setStatus(Constructor, 'IDLE');
		return instance;
	};
	
	// reflection is allowed also on Class and Singleton super-constructors
	Class.construct = Singleton.construct = function() {
		return this;
	};
	
	Class.extend = Singleton.extend = function(Child) {
		return extend(false, Child, this === Singleton);
	};
	
	// a bit of circularity:
	Class.parent = Class;
	Singleton.parent = Singleton;
	
	// public method to get an array of all the defined classes traced:
	Class.getRegisteredClasses = function() {
		return _register.getRegisteredClasses();
	};
	
	// add the extend method to the Class itself and its child instances:
	var extend = function extend(Parent, Child, isSingleton) {
		// this method returns an extended class from a Parent and a Child class
		if (arguments.length === 1) {
			if (typeof(Parent) === 'function') {
				return new Class(Parent);
			}
			return;
		}
		
		if (typeof(Child) !== 'function') {
			throw new Error('Invalid argument given as constructor to be extended');
		}
		
		// the constructor to be returned:
		var Constructor = function Constructor() {
			build(Constructor, Parent, Child, isSingleton, this, arguments);
		};
		
		var build = function build(Constructor, Parent, Child, isSingleton, instance, args) {
			// delegate function to build the new contructor
			var extending = _register.getStatus(Constructor) === 'EXTENDING';
			var reflecting = _register.getStatus(Constructor) === 'REFLECTING';
			var protectedProps = _register.getProtected(Parent === Class || Parent === Singleton ? Child : Parent);
			
			instance.parent = {}; // reference to the parent instance, to inherit dynamic properties
			
			if (instance instanceof Constructor && isSingleton) {
				var instances = _register.getInstancesByConstructor(Constructor);
				
				if (reflecting === false && extending === false) {
					// the Singleton has been instantiated with the "new" keyword:
					throw new Error('Singleton instances must be retrieved through the getInstance method');
				} else if (instances !== false && instances.length > 0) {
					// return the unique instance:
					return instances[0];
				}
			}
			
			if (Parent !== false) {
				// inform the parent constructor that it is being extended:
				_register.setStatus(Parent, 'EXTENDING');
				// call the parent into the current scope without providing arguments ("constructor stealing" inheritance pattern):
				Parent.call(instance);
				
				// create a reference to dynamic parent's properties:
				for (var prop in instance) {
					instance.parent[prop] = instance[prop];
				}
				// update the extending status:
				_register.setStatus(Parent, 'IDLE');
			}
			
			if (instance instanceof Constructor && instance.hasOwnProperty('init')) {
				// if set, delete the init method of the parent instance:
				delete instance.init;
			}
			
			// get the correct arguments object:
			args = reflecting ? args[0] : args;
			Array.prototype.unshift.call(args, protectedProps);
			
			// call the child ("constructor stealing" inheritance pattern):
			Child.apply(instance, args);
			
			if (instance instanceof Constructor) {
				if (!extending && instance.hasOwnProperty('init')) {
					// if exists, call the init method of the Child class passing the constructor arguments:
					instance.init.apply(instance, args);
				}
				if (_config.trace === 'ALL' || (_config.trace === 'SINGLETON' && isSingleton)) {
					// register the instance:
					_register.trace(Constructor, instance, isSingleton);
				}
			}
			// reference the constructor:
			instance.constructor = Child;
		};
		
		// allow inheritance chain and reference the superclass:
		if (Parent !== false) {
			Child.prototype = Parent.prototype;
			Constructor.parent = Parent;
		} else {
			Constructor.parent = isSingleton ? Singleton : Class;
		}
		Constructor.prototype = Child.prototype;
		
		// reference the proxy constructor from the constructor and vice-versa:
		Constructor.assignee = Child;
		Child.proxy = Constructor;
		
		// set Class or Singleton as constructor of first level classes (optional, does not mean anything):
		// Constructor.constructor = isSingleton ? Singleton : Class;
		
		if (_config.trace === 'ALL' || (_config.trace === 'SINGLETON' && isSingleton)) {
			// register the constructor:
			_register.trace(Constructor, null, isSingleton);
		}
		
		Constructor.isRegistered = function() {
			return _register.getTrace(this) !== false;
		};
		
		Constructor.isSingleton = function() {
			return isSingleton;
		};
		
		// make it extensible:
		Constructor.extend = function(NewChild) {
			return extend(this, NewChild, isSingleton);
		};
		
		if (isSingleton) {
			// create a proper method to get the single instance:
			Constructor.getInstance = function() {
				var trace = _register.getTrace(this);
				if (trace && trace.instances.length > 0) {
					return trace.instances[0];
				}
				return construct(this, arguments);
			};
		} else {
			// allow class reflection:
			Constructor.construct = function() {
				return construct(this, arguments);
			};
		}
		
		/**
			public method to delete constructors or instances from the internal register;
			returns true if the deletion is successful, false otherwise (e.g. the constructor/instance was not registered or is already deleted);
			it does not delete a constructor from the memory, but deleting all the references makes it eligible for garbage collection;
		**/
		Constructor.unregister = function() {
			return _register.unregister(this);
		};
		
		return Constructor;
	};
	
	// assign constructor references to the given context:
	_config.context.Class = Class;
	_config.context.Singleton = Singleton;
})();




plug.Base = new Class(function(options) {
	this.init = function() {
		this.config = {}; // class configuration options
		this.setOptions(options);
	};
	this.getOption = function(option, context) {
		// get an option from the default options object
		context = context || this.config;
		if (context !== undefined && context.hasOwnProperty(option)) {
			return context[option];
		}
	};
	this.setOption = function(option, value, context) {
		// set an option if it is allowed in the default options object
		context = context || this.config;
		if (context !== undefined && context.hasOwnProperty(option)) {
			context[option] = value;
		}
		return this;
	};
	this.setOptions = function(options, context) {
		// overwrite the given options on the default options object
		context = context || this.config;
		if (typeof(options) === 'object') {
			for (var i in options) {
				this.setOption(i, options[i], context);
			}
		}
		return this;
	};
	this.getSelector = function(element) {
		// get a node representation as a string; e.g. DIV.clear, or SPAN#counter
		var $element = $(element),
			nodeName = $element.length > 0 ? $element[0].nodeName : '',
			description = '';
		
		if ($element.attr('id')) {
			description += '#' + $element.attr('id');
		}
		if ($element.attr('class')) {
			var classes = $element.attr('class').replace(/^\s+|\s+$/, '').replace(/\s+/, ' ').split(' ').join('.');
			if (classes !== '') {
				description += '.' + classes;
			}
		}
		return nodeName + description;
	};
});




plug.ErrorManager = plug.Base.extend(function(options) {
	// The fact that this class is a child of the Base class makes it more error-prone, as subdue to errors occurring in the parent class.
	// This exposure is somehow reduced as it uses only the "init" and "setOptions" methods and the way it is triggered from the constructor, although it inherits all the Base class' stuff.
	/*
		Project assumptions:
			* Assume your code will fail
			* Log errors to the server
			* You, not the browser, handle errors
			* Identify where errors might occur
			* Throw your own errors
			* Distinguish fatal versus non-fatal errors
			* Provide a debug mode
	 
	 References:
		http://stackoverflow.com/questions/6484528/what-are-the-best-practices-for-javascript-error-handling
		http://eloquentjavascript.net/chapter5.html
		http://www.devhands.com/2008/10/javascript-error-handling-and-general-best-practices/
	*/
	
	/**
		Error manager class
		Usage example:
			plug.ErrorManager.construct({
				clientLogging: false,
				serverLogging: true,
				endpoint: 'http://www.example.com/error-logger.jsp'
			});
			try {
				// code
			} catch(error) {
				plug.errorManager.log(error);
			}
	**/
	var self = this,
		_config,
		_props; // all possible error properties
	
	this.init = function() {
		_config = {
			clientLogging: true, // sets if the error must be logged in the browser
			serverLogging: false, // sets if the error must be sent to the server
			endpoint: false // URL of the server resource which receives the errors
		};
		
		// check the argument type:
		if (typeof(options) === 'undefined' || !(options instanceof Object)) {
			options = {};
		}
		this.setOptions(options, _config);
		
		// error object properties implemented in various browsers:
		_props = [
			'name', // (all browsers); the name of the error
			'message', // (all browsers); the error message as a string
			'description', // (Internet Explorer); description of the error
			'fileName', // (Firefox); the name of the file where the error occurred
			'lineNumber', // (Firefox); the number of line where the error occurred
			'columnNumber', // (Firefox); the number of column where the error occurred
			'number', // (Internet Explorer); the error code as a number
			'stack' // (Firefox); detailed information about the location where the error exactly occurred
		];
		
		// initialize the window.console object if undefined:
		_initConsole();
		
		// save the current instance into the framework namespace:
		plug.errorManager = this;
	};
	var _createClientDesc = function(error) {
		// this method returns a human-readable string to be logged into a console for client-side debugging
		var errors = [];
		
		// check the argument type:
		if (typeof(error) === 'undefined' || !(error instanceof Object)) {
			error = {};
		}
		
		// Error is a host object, so we cannot iterate over it; it is only possible accessing known properties, if defined:
		for (var i in _props) {
			var prop = _props[i];
			if (typeof(error[prop]) !== 'undefined') {
				errors.push(prop + ': ' + error[prop]);
			}
		}
		if (errors.length > 0) {
			errors.unshift('User-Agent: ' + navigator.userAgent);
		}
		
		return errors.join('\n');
	};
	var _createServerDesc = function(error) {
		// this method returns a query string with all the error information available, to be appended to the server endpoint
		var errors = [];
		
		// check the argument type:
		if (typeof(error) === 'undefined' || !(error instanceof Object)) {
			error = {};
		}
		
		// Error is a host object, so we cannot iterate over it; it is only possible accessing known properties, if defined:
		for (var i in _props) {
			var prop = _props[i];
			if (typeof(error[prop]) !== 'undefined') {
				errors.push(
					encodeURIComponent(prop) + '=' +
					encodeURIComponent(error[prop])
				);
			}
		}
		if (errors.length > 0) {
			errors.unshift('User-Agent=' + encodeURIComponent(navigator.userAgent));
		}
		
		return errors.join('&');
	};
	var _initConsole = function() {
		// this method builds an alternative object to the Firebug window.console, if not available:
		window.console = window.console || new function() {
			// this basic class creates a custom window.console object with functionalities similar to the ones provided in Firefox and Chrome
			var _history = [];
			
			this.log = function() {
				for (var i in arguments) {
					_history.push(arguments[i]);
				}
			};
			this.getHistory = function() {
				return _history;
			};
		};
	};
	this.log = function(error) {
		// this public method logs the error in the environment specified in the options
		if (typeof(error) === 'undefined' || !(error instanceof Object)) {
			// quit if argument is not valid
			return;
		}
		
		if (_config.serverLogging && _config.endpoint) {
			try {
				var serverDesc = _createServerDesc(error);
				if (serverDesc) {
					// log only if not empty
					var image = new Image();
					image.src = _config.endpoint + '?' + serverDesc;
				}
			} catch(error) {
				if (_config.clientLogging) {
					console.log(_createClientDesc(error));
				}
			}
		}
		if (_config.clientLogging) {
			var clientDesc = _createClientDesc(error);
			if (clientDesc) {
				console.log(clientDesc);
			}
		}
	};
});


plug.Controller = new Singleton(function(_, options) {
	var self = this,
		_config,
		_subControllers;
	
	this.init = function() {
		_subControllers = {};
	};
	this.addSubController = function(name, SubController) {
		// this method instantiates a subController and registers the instance by the name within the main controller
		if (SubController.isSingleton()) {
			var subController = SubController.getInstance();
		} else {
			var subController = new SubController();
		}
		
		_subControllers[name] = subController;
	};
	this.getSubController = function(name) {
		// this method gets the instance of a subController by the name of its constructor
		if (name in _subControllers) {
			return _subControllers[name];
		}
	};
});


// window.controller = new plug.Controller();

