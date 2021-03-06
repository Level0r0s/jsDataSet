/**
 * Created by Gaetano Lazzo on 07/02/2015.
 * Thanks to lodash, ObjectObserve
 */
/* jslint nomen: true */
/* jslint bitwise: true */
/*globals Environment,jsDataAccess,Function */


(function (_, ObjectObserver, dataQuery) {
    'use strict';
    /** Used as a safe reference for `undefined` in pre-ES5 environments. (thanks lodash)*/
    var undefined;

    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5 internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }

            var aArgs = Array.prototype.slice.call(arguments, 1),
                fToBind = this,
                FNOP = function () {
                },
                fBound = function () {
                    return fToBind.apply(this instanceof FNOP && oThis ? this : oThis,
                        aArgs.concat(Array.prototype.slice.call(arguments)));
                };

            FNOP.prototype = this.prototype;
            fBound.prototype = new FNOP();

            return fBound;
        };
    }


    /** Used to determine if values are of the language type `Object`. (thanks lodash)*/
    var objectTypes = {
        'function': true,
        'object': true
    };

    //noinspection JSUnresolvedVariable
    /**
     * Used as a reference to the global object. (thanks lodash)
     *
     * The `this` value is used if it is the global object to avoid Greasemonkey's
     * restricted `window` object, otherwise the `window` object is used.
     */
    var root = (objectTypes[typeof window] && window !== (this && this.window)) ? window : this;

    //noinspection JSUnresolvedVariable
    /** Detect free variable `exports`. (thanks lodash) */
    var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

    //noinspection JSUnresolvedVariable
    /** Detect free variable `module`. (thanks lodash)*/
    var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

    //noinspection JSUnresolvedVariable
    /** Detect free variable `global` from Node.js or Browserified code and use it as `root`. (thanks lodash)*/
    var freeGlobal = freeExports && freeModule && typeof global == 'object' && global;
    //noinspection JSUnresolvedVariable
    if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal)) {
        root = freeGlobal;
    }

    /** Detect the popular CommonJS extension `module.exports`. (thanks lodash)*/
    var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;


    function isAngularField(f) {
        return (f.substr(0, 2) === '$$');
    }


    /**
     * @public
     * @typedef {$rowState} dataRowState
     * @property  {DataRowState} detached
     * @property  {DataRowState} deleted
     * @property {DataRowState} added
     * @property  {DataRowState} unchanged
     * @property  {DataRowState} modified
     */

    //noinspection JSValidateTypes
    /**
     * @property $rowState
     * @public
     * @class dataRowState
     */
    var $rowState = {
            detached: "detached",
            deleted: "deleted",
            added: "added",
            unchanged: "unchanged",
            modified: "modified"
        },


        /**
         * @public
         * @typedef {$rowVersion} dataRowVersion
         * @property  {DataRowVersion} original
         * @property  {DataRowVersion} current
         */

        /**
         * Enumerates possible version of a DataRow field: original, current
         * @public
         * @property $rowVersion
         * @class DataRowVersion
         */
        $rowVersion = {
            original: "original",
            current: "current"
        };


    /**
     * Create a DataColumn
     * @param {string} columnName
     * @param {string} type of the column field
     **/
    function DataColumn(name, ctype) {

        /**
         * name of the column
         * @property {string} name
         **/
        this.name = name;

        /**
         * type of the column
         * @property {string} ctype
         **/
        this.ctype = ctype;

    }


    /**
     * DataRow shim, provides methods to manage objects as Ado.Net DataRows
     * @module DataSet
     * @submodule DataRow
     */

    /**
     * Internal class attached to dataRow model data and used to track object changes
     * @private
     * @class DataRowObserver
     * @param {ObjectRow} d
     * @constructor
     */
    function DataRowObserver(d) {
        /**
         * @property r
         * @type {ObjectRow}
         */
        this.r = d;
    }


    DataRowObserver.prototype = {
        constructor: DataRowObserver,

        /**
         * Take track of object changes, managing added fields, removed fields, modified fields.
         * This is called automatically by the ObjectObserver attached to the object
         * @internal
         * @method dataRowReactOnChange
         * @param added
         * @param removed
         * @param changed
         * @param getOldValueFn
         */
        dataRowReactOnChange: function (added, removed, changed, getOldValueFn) {
            if (this.r.state === $rowState.deleted || this.r.state === $rowState.added) {
                return;
            }
            var that = this;
            // respond to changes to the obj.
            Object.keys(added).forEach(function (property) {
                if (isAngularField(property)) {
                    return;
                }
                if (that.r.removed.hasOwnProperty(property)) {
                    //adding a property that was previously removed
                    if (that.r.removed[property] !== added[property]) {
                        //if the property had been removed with a different value, that values now goes into
                        // old values
                        that.r.old[property] = that.r.removed[property];
                    }
                    delete that.r.removed[property];
                }
                else {
                    that.r.added[property] = added[property];
                }
            });

            Object.keys(removed).forEach(function (property) {
                if (isAngularField(property)) {
                    return;
                }
//                property; // a property which has been been removed from obj
//                getOldValueFn(property); // its old value
                if (that.r.added.hasOwnProperty(property)) {
                    delete that.r.added[property];
                }
                else {
                    if (that.r.old.hasOwnProperty(property)) {
                        //removing a property that had been previously modified
                        that.r.removed[property] = that.r.old[property];
                    }
                    else {
                        that.r.removed[property] = getOldValueFn(property);
                    }
                }
            });

            Object.keys(changed).forEach(function (property) {
                if (isAngularField(property)) {
                    return;
                }

                //if property is added, old values has not to be set
                if (!that.r.added.hasOwnProperty(property)) {
                    if (!that.r.old.hasOwnProperty(property)) {
                        that.r.old[property] = getOldValueFn(property);
                    }
                    else {
                        if (that.r.old[property] === changed[property]) {
                            delete that.r.old[property];
                        }
                    }
                }
                //property; // a property on obj which has changed value.
                //changed[property]; // its new value
                //getOldValueFn(property); // its old value
            });
        },
        toString: function () {
            return 'DataRowObserver on ' + this.r;
        }

    };


    /**
     * class type to host data
     * @public
     * @class ObjectRow
     */
    function ObjectRow() {
        return null;
    }
    ObjectRow.prototype = {
        constructor: ObjectRow,
        /**
         * Gets the DataRow linked to an ObjectRow
         * @public
         * @method getRow
         * @returns {DataRow}
         */
        getRow : function () {
            return null;
        }
    }


    /**
     * Provides methods to manage objects as Ado.Net DataRows
     * @class DataRow
     */


    /**
     *
     * Creates a DataRow from a generic plain object, and returns the DataRow
     * @method DataRow
     * @param {object} o this is the main object managed by the application logic, it is attached to a getRow function
     * @returns {DataRow}
     * @constructor
     */
    function DataRow(o) {

        if (o.constructor === DataRow) {
            throw 'Called  DataRow with a DataRow as input parameter';
        }

        if (o.getRow) {
            if (this && this.constructor === DataRow) {
                o = _.clone(o);
                //throw 'Called new DataRow with an object already attached to a DataRow';
            }
            else {
                return o.getRow();
            }
        }

        if (this === undefined || this.constructor !== DataRow) {
            return new DataRow(o);
        }


        if (!o || typeof o !== 'object') {
            throw ('DataRow(o) needs an object as parameter');
        }

        /**
         * current value of the DataRow is the ObjectRow o itself
         * @private
         * @property {ObjectRow} current
         */
        this.current = o;
        /**
         * previous values of the DataRow, only previous values of changed fields are stored
         * @private
         * @property {object} old
         */
        this.old = {};

        /**
         * fields added to object (after last acceptChanges())
         * @private
         * @property {object} added
         */
        this.added = {};

        /**
         * fields removed (with delete o.field) from object (after last acceptChanges())
         * @private
         * @property {object} removed
         */
        this.removed = {};

        this.myState = $rowState.unchanged;
        var that = this,
            dObs;

        /**\
         * State of the DataRow, possible values are added unchanged modified deleted detached
         * @property  state
         * @type DataRowState
         */
        Object.defineProperty(this, 'state', {
            get: function () {
                this.commit();
                if (that.myState === $rowState.modified || that.myState === $rowState.unchanged) {
                    if (Object.keys(that.old).length === 0 &&
                            Object.keys(that.added).length === 0 &&
                            Object.keys(that.removed).length === 0) {
                        that.myState = $rowState.unchanged;
                    }
                    else {
                        that.myState = $rowState.modified;
                    }
                }
                return that.myState;
            },
            set: function (value) {
                that.myState = value;
            },
            enumerable: false
        });


        /**
         * Get the DataRow attached to an object. This method is attached to the object itself,
         *  so you can get the DataRow calling o.getRow() where o is the plain object
         * This transforms o into an ObjectRow
         */
        Object.defineProperty(o, 'getRow', {
            value: function () {
                return that;
            },
            enumerable: false,
            configurable: true   //allows a successive deletion of this property
        });


        //Create an observer on this
        dObs = new DataRowObserver(this);
        this.observer = new ObjectObserver(this.current);
        this.observer.open(dObs.dataRowReactOnChange.bind(dObs));
    }

    /**
     * @type {DataRow}
     */
    DataRow.prototype = {
        constructor: DataRow,

        /**
         * get the value of a field of the object. If dataRowVer is omitted, it's equivalent to o.fieldName
         * @method getValue
         * @param {string} fieldName
         * @param {DataRowVersion} [dataRowVer='current'] possible values are 'original', 'current'
         * @returns {object}
         */
        getValue: function (fieldName, dataRowVer) {
            this.commit();
            if (dataRowVer === $rowVersion.original) {
                if (this.old.hasOwnProperty(fieldName)) {
                    return this.old[fieldName];
                }
                if (this.removed.hasOwnProperty(fieldName)) {
                    return this.removed[fieldName];
                }
                if (this.added.hasOwnProperty(fieldName)) {
                    return undefined;
                }

            }
            return this.current[fieldName];
        },

        /**
         * Gets the original row, before changes was made, undefined if current state is added
         * @method originalRow
         * @return {object}
         */
        originalRow: function () {
            this.commit();
            if (this.state === $rowState.unchanged || this.state === $rowState.deleted) {
                return this.current;
            }
            if (this.state === $rowState.added) {
                return undefined;
            }

            var o = {},
                that = this;
            _.forEach(_.keys(this.removed), function (k) {
                o[k] = that.removed[k];
            });
            _.forEach(_.keys(this.old), function (k) {
                o[k] = that.old[k];
            });
            _.forEach(_.keys(this.current), function (k) {
                if (that.added.hasOwnProperty(k)) {
                    return; //not part of original row
                }
                if (that.old.hasOwnProperty(k)) {
                    return; //not part of original row
                }
                o[k] = that.current[k];
            });
            return o;
        },
        /**
         * Make this row identical to another row (both in state, original and current value)
         * @param r {DataRow}
         * @return {DataRow}
         */
        makeSameAs: function (r) {
            if (this.state === $rowState.deleted) {
                this.rejectChanges();
            }
            if (r.state === $rowState.deleted) {
                return this.makeEqualTo(r.originalRow()).acceptChanges().del();
            }
            if (r.state === $rowState.unchanged) {
                return this.makeEqualTo(r.current).acceptChanges();
            }
            if (r.state === $rowState.modified) {
                return this.makeEqualTo(r.originalRow()).acceptChanges().makeEqualTo(r.current);
            }
            if (r.state === $rowState.added) { //assumes this also is already in the state of "added"
                return this.makeEqualTo(r.current);
            }
            return this;
        },


        /**
         * changes current row to make it's current values equal to another one. Deleted rows becomes modified
         * compared to patchTo, this also removes values that are not present in other row
         * @method makeEqualTo
         * @param {object} o
         * @return {DataRow}
         */
        makeEqualTo: function (o) {
            /**
             * @type {DataRow}
             */
            var that = this;
            if (this.state === $rowState.deleted) {
                this.rejectChanges();
            }
            //removes properties that are not present in o
            _.forEach(_.keys(this.current), function (k) {
                if (!o.hasOwnProperty(k)) {
                    delete that.current[k];
                }
            });

            //get all properties from o
            _.forEach(_.keys(o), function (k) {
                that.current[k] = o[k];
            });

            this.commit();
            return that;
        },
        /**
         * changes current row to make it's current values equal to another one. Deleted rows becomes modified
         * @method patchTo
         * @param {object} o
         * @return {DataRow}
         */
        patchTo: function (o) {
            var that = this;
            if (this.state === $rowState.deleted) {
                this.rejectChanges();
            }

            //get all properties from o
            _.forEach(_.keys(o), function (k) {
                that.current[k] = o[k];
            });

            this.commit();
            return this;
        },
        /**
         * get changes from the ObjectObserver
         * @method commit
         * @internal
         */
        commit: function () {
            if (this.observer) {
                this.observer.deliver();
            }
        },
        getModifiedFields: function () {
            return _.union(_.keys(this.old), _.keys(this.removed), _.keys(this.added));
        },

        /**
         * Makes changes permanents, discarding old values. state becomes unchanged.
         * @method acceptChanges
         * @return {DataRow}
         */
        acceptChanges: function () {
            if (this.state === $rowState.detached) {
                return this;
            }
            if (this.state === $rowState.deleted) {
                this.detach();
                return this;
            }
            this.commit();
            this.reset();
            return this;
        },

        /**
         * Discard changes, restoring the original values of the object. state becomes unchanged
         * @method rejectChanges
         * @return {DataRow}
         */
        rejectChanges: function () {
            if (this.state === $rowState.detached) {
                return this;
            }

            if (this.state === $rowState.added) {
                this.detach();
                return this;
            }
            this.commit();
            _.extend(this.current, this.old);
            var that = this;
            _.forEach(this.added, function (value, fieldToDel) {
                delete that.current[fieldToDel];
            });
            _.forEach(this.removed, function (value, fieldToAdd) {
                that.current[fieldToAdd] = that.removed[fieldToAdd];
            });

            this.commit();
            this.reset();
            return this;
        },

        /**
         * resets all change and sets state to unchanged
         * @private
         * @method _reset
         * @return {DataRow}
         */
        reset: function () {
            this.old = {};
            this.added = {};
            this.removed = {};
            this.state = $rowState.unchanged;
            return this;
        },

        /**
         * Detaches row, loosing all changes made. object is also removed from the underlying DataTable
         * @method detach
         * @return {undefined}
         */
        detach: function () {
            this.state = $rowState.detached;
            if (this.observer) {
                this.observer.discardChanges();
                this.observer.close();
                delete this.observer;
            }
            if (this.table) {
                this.table.detach(this.current);
            }
            delete (this.current).getRow;
            return undefined;
        },

        /**
         * Deletes the row. If it is in added state it becomes detached. Otherwise any changes are lost, and
         *  only rejectChanges can bring the row into life again
         *  @method del
         *  @returns {DataRow}
         */
        del: function () {
            if (this.state === $rowState.deleted) {
                return this;
            }
            if (this.state === $rowState.added) {
                this.detach();
                return this;
            }
            if (this.state === $rowState.detached) {
                return this;
            }
            this.rejectChanges();
            this.state = $rowState.deleted;
            return this;
        },

        /**
         * Debug - helper function
         * @method toString
         * @returns {string}
         */
        toString: function () {
            if (this.table) {
                return 'DataRow of table ' + this.table.name + ' (' + this.state + ')';
            }
            return 'DataRow' + ' (' + this.state + ')';
        },

        /**
         * Gets the parent(s) of this row in the dataSet it is contained, following the relation with the
         *  specified name
         * @method getParentRows
         * @param {string} relName
         * @returns {ObjectRow[]}
         */
        getParentRows: function (relName) {
            var rel = this.table.dataset.relations[relName];
            if (rel === undefined) {
                throw 'Relation ' + relName + ' does not exists in dataset ' + this.table.dataset.name;
            }
            return rel.getParents(this.current);
        },

        /**
         * Gets all parent rows of this one
         * @returns {ObjectRow[]}
         */
        getAllParentRows: function () {
            var that = this;
            return _(this.table.dataset.relationsByChild[this.table.name])
                .value()
                .reduce(function (list, rel) {
                    return list.concat(rel.getParents(that.current));
                }, [], this);
        },
        /**
         * Gets parents row of this row in a given table
         * @method getParentsInTable
         * @param {string} parentTableName
         * @returns {ObjectRow[]}
         */
        getParentsInTable: function (parentTableName) {
            var that = this;
            return _(this.table.dataset.relationsByChild[this.table.name])
                .filter({parentTable: parentTableName})
                .value()
                .reduce(function (list, rel) {
                    return list.concat(rel.getParents(that.current));
                }, [], this);
        },

        /**
         * Gets the child(s) of this row in the dataSet it is contained, following the relation with the
         *  specified name
         * @method getChildRows
         * @param {string} relName
         * @returns {ObjectRow[]}
         */
        getChildRows: function (relName) {
            var rel = this.table.dataset.relations[relName];
            if (rel === undefined) {
                throw 'Relation ' + relName + ' does not exists in dataset ' + this.tables.dataset.name;
            }
            return rel.getChilds(this.current);
        },

        /**
         * Gets all child rows of this one
         * @returns {ObjectRow[]}
         */
        getAllChildRows: function () {
            var that = this;
            return _(this.table.dataset.relationsByParent[this.table.name])
                .value()
                .reduce(function (list, rel) {
                    return list.concat(rel.getChilds(that.current));
                }, []);
        },

        /**
         * Gets child rows of this row in a given table
         * @method getChildsInTable
         * @param  {string} childTableName
         * @returns {ObjectRow[]}
         */
        getChildsInTable: function (childTableName) {
            var that = this;
            return _(this.table.dataset.relationsByParent[this.table.name])
                .filter({childTable: childTableName})
                .value()
                .reduce(function (list, rel) {
                    return list.concat(rel.getChilds(that.current));
                }, []);
        },

        /**
         * DataTable that contains this DataRow
         * @property table
         * @type DataTable
         */

        /**
         * Get an object with all key fields of this row
         * @method keySample
         * @returns {object}
         */
        keySample: function () {
            return _.pick(this.current, this.table.key);
        }

    };


    /**
     * Describe how to evaluate the value of a column before posting it
     * @class AutoIncrementColumn
     *
     **/

    /**
     * Create a AutoIncrementColumn
     * @constructor AutoIncrementColumn
     * @param {string} columnName
     * @param {object} options same options as AutoIncrement properties
     **/
    function AutoIncrementColumn(columnName, options) {
        /**
         * name of the column that has to be auto-incremented
         * @property {string} columnName
         */
        this.columnName = columnName;

        /**
         * Array of column names of selector fields. The max() is evaluating filtering the values of those fields
         * @property {string[]} [selector]
         */
        this.selector = options.selector || [];

        /**
         * Array of bit mask to use for comparing selector. If present, only corrisponding bits will be compared,
         *  i.e. instead of sel=value it will be compared (sel & mask) = value
         * @property {number[]} [selectorMask]
         **/
        this.selectorMask = options.selectorMask || [];

        /**
         * A field to use as prefix for the evaluated field
         * @property {string} [prefixField]
         **/
        this.prefixField = options.prefixField;

        /**
         * String literal to be appended to the prefix before the evaluated max
         * @property {string} [middleConst]
         **/
        this.middleConst = options.middleConst;


        /**
         * for string id, the len of the evaluated max. It is not the overall size of the evaluated id, because a
         *  prefix and a middle const might be present
         * If idLen = 0 and there is no prefix, the field is assumed to be a number, otherwise a 0 prefixed string-number
         *  @property {number} [idLen=0]
         **/
        this.idLen = options.idLen || 0;

        /**
         * Indicates that numbering does NOT depend on prefix value, I.e. is linear in every section of the calculated field
         * @property {boolean} [linearField=false]
         **/
        this.linearField = options.linearField || false;

        /**
         * Minimum temporary value for in-memory rows
         * @property {number} [minimum=0]
         **/
        this.minimum = options.minimum || 0;

        /**
         * true if this field is a number
         * @property {number} [isNumber=false]
         **/
        if (options.isNumber === undefined) {
            this.isNumber = (this.idLen === 0) && (this.prefixField === undefined) &&
                (this.middleConst === undefined);
        }
        else {
            this.isNumber = options.isNumber;
        }

        if (this.isNumber === false && this.idLen === 0) {
            this.idLen = 12; //get a default for idLen
        }
    }

    AutoIncrementColumn.prototype = {
        constructor: AutoIncrementColumn
    };

    /**
     * Gets a function that filter selector fields eventually masking with selectorMask
     * @param row
     * @returns {sqlFun}
     */
    AutoIncrementColumn.prototype.getFieldSelectorMask = function (row) {
        var that = this;
        if (this.getInternalSelector === undefined) {
            this.getInternalSelector = function (r) {
                return dataQuery.and(
                    _.map(that.selector, function (field, index) {
                        if (that.selectorMask && that.selectorMask[index]) {
                            return dataQuery.testMask(field, that.selectorMask[index], r[field]);
                        }
                        else {
                            return dataQuery.eq(field, r[field]);
                        }
                    })
                );
            };
        }
        return this.getInternalSelector(row);
    };

    /**
     * evaluates the function to filter selector on a specified row and column
     * @method getSelector
     * @param {ObjectRow} r
     * @returns {sqlFun}
     */
    AutoIncrementColumn.prototype.getSelector = function (r) {
        var prefix = this.getPrefix(r),
            selector = this.getFieldSelectorMask(r);

        if (this.linearField === false && prefix !== '') {
            selector = dataQuery.and(selector, dataQuery.like(this.columnName, prefix + '%'));
        }
        return selector;
    };

    /**
     * Gets the prefix evaluated for a given row
     * @method getPrefix
     * @param r
     * @returns string
     */
    AutoIncrementColumn.prototype.getPrefix = function (r) {
        var prefix = '';
        if (this.prefixField) {
            if (r[this.prefixField] !== null && r[this.prefixField] !== undefined) {
                prefix += r[this.prefixField];
            }
        }
        if (this.middleConst) {
            prefix += this.middleConst;
        }
        return prefix;
    };

    /**
     * gets the expression to be used for retrieving the max
     * @method getExpression
     * @param {ObjectRow} r
     * @return {sqlFun}
     */
    AutoIncrementColumn.prototype.getExpression = function (r) {
        var fieldExpr = dataQuery.field(this.columnName),
            lenToExtract,
            startSearch;
        if (this.isNumber) {
            return dataQuery.max(fieldExpr);
        }
        startSearch = this.getPrefix(r).length;
        lenToExtract = this.idLen;
        return dataQuery.max(dataQuery.convertToInt(dataQuery.substring(fieldExpr, startSearch + 1, lenToExtract)));
    };


    /**
     * Optional custom function to be called to evaluate the maximum value
     * @method customFunction
     * @param {ObjectRow} r
     * @param {string} columnName
     * @param {jsDataAccess} conn
     * @return {object}
     **/
    AutoIncrementColumn.prototype.customFunction = null;


    /**
     * A DataTable is s collection of ObjectRow and provides information about the structure of logical table
     * @class DataTable
     */

    /**
     * DataSet to which this table belongs
     * @property {DataSet} dataset
     */

    /**
     * Creates an empty DataTable
     * @param {string} tableName
     * @constructor
     * @return {DataTable}
     */
    function DataTable(tableName) {
        /**
         * Name of the table
         * @property {string} name
         */
        this.name = tableName;

        /**
         * Collection of rows, each one hiddenly surrounded with a DataRow object
         * @property rows
         * @type ObjectRow[]
         */
        this.rows = [];

        /**
         * Array of key column names
         * @private
         * @property {string[]} myKey
         */
        this.myKey = [];

        /**
         * Set of properties to be assigned to new rows when they are created
         * @property {object} myDefaults
         * @private
         */
        this.myDefaults = {};

        /**
         * Dictionary of DataColumn
         * @property columns
         * @type {DataColumn[]}
         */
        this.columns = {};

        /**
         * @property autoIncrementColumns
         * @type {AutoIncrementColumn[]}
         */
        this.autoIncrementColumns = {};

        /**
         * A ordering to use for posting of this table
         * @property postingOrder
         * @type string | string[] | function
         */
    }

    DataTable.prototype = {
        constructor: DataTable,

        /**
         * @private
         * @property maxCache
         * @type object
         */

        /**
         * Mark the table as optimized / not optimized
         * An optimized table has a cache for all autoincrement field
         * @method setOptimize
         * @param {boolean} value
         */
        setOptimized: function (value) {
            if (value === false) {
                delete this.maxCache;
                return;
            }
            if (this.maxCache === undefined) {
                this.maxCache = {};
            }
        },

        /**
         * Check if this table is optimized
         * @method isOptimized
         * @returns {boolean}
         */
        isOptimized: function () {
            return this.maxCache !== undefined;
        },

        /**
         * Clear evaluated max cache
         * @method clearMaxCache
         */
        clearMaxCache: function () {
            if (this.maxCache !== undefined) {
                this.maxCache = {};
            }
        },

        /**
         * Set a value in the max cache
         * @method setMaxExpr
         * @param {string} field
         * @param {sqlFun} expr
         * @param {sqlFun} filter
         * @param {int} num
         */
        setMaxExpr: function (field, expr, filter, num) {
            if (this.maxCache === undefined) {
                return;
            }
            var hash = field + '§' + expr.toString() + '§' + filter.toString();
            this.maxCache[hash] = num;
        },


        setDataColumn: function (name, ctype) {

            this.columns[name] = new DataColumn(name, ctype);

        },


        /**
         * get/set the minimum temp value for a field, assuming 0 if undefined
         * @method minimumTempValue
         * @param  {string} field
         * @param {number} [value]
         */
        minimumTempValue: function (field, value) {
            var autoInfo = this.autoIncrementColumns[field];
            if (autoInfo === undefined) {
                if (value === undefined) {
                    return 0;
                }
                this.autoIncrementColumns[field] = new AutoIncrementColumn(field, {minimum: value});
            }
            else {
                if (value === undefined) {
                    return autoInfo.minimum || 0;
                }
                autoInfo.minimum = value;
            }
        },


        /**
         * gets the max in cache for a field and updates the cache
         * @method getMaxExpr
         *@param {string} field
         * @param {sqlFun|string}expr
         * @param {sqlFun} filter
         * @return {number}
         */
        getMaxExpr: function (field, expr, filter) {
            var hash = field + '§' + expr.toString() + '§' + filter.toString(),
                res = this.minimumTempValue(field);
            if (this.maxCache[hash] !== undefined) {
                res = this.maxCache[hash];
            }
            this.maxCache[hash] = res + 1;
            return res;
        },

        /**
         * Evaluates the max of an expression eventually using a cached value
         * @method cachedMaxSubstring
         * @param {string} field
         * @param {number} start
         * @param {number} len
         * @param {sqlFun} filter
         * @return {number}
         */
        cachedMaxSubstring: function (field, start, len, filter) {
            var expr;
            if (!this.isOptimized()) {
                return this.unCachedMaxSubstring(field, start, len, filter);

            }
            expr = field + '§' + start + '§' + len + '§' + filter.toString();
            return this.getMaxExpr(field, expr, filter);
        },

        /**
         *  Evaluates the max of an expression without using any cached value. If len = 0 the expression is managed
         *   as a number with max(field) otherwise it is performed max(convertToInt(substring(field,start,len)))
         * @param {string} field
         * @param {number} start
         * @param {number} len
         * @param {sqlFun} filter
         * @return {number}
         */
        unCachedMaxSubstring: function (field, start, len, filter) {

            var res,
                min = this.minimumTempValue(field),
                expr,
                rows;
            if (start === 0 && len === 0) {
                expr = dataQuery.max(field);
            }
            else {
                expr = dataQuery.max(dataQuery.convertToInt(dataQuery.substring(field, start, len)));
            }

            rows = this.selectAll(filter);
            if (rows.length === 0) {
                res = 0;
            }
            else {
                res = expr(rows);
            }

            if (res < min) {
                return min;
            }
            return res;
        },

        /**
         * Extract a set of rows matching a filter function - skipping deleted rows
         * @method select
         * @param {sqlFun} [filter]
         * @returns {ObjectRow[]}
         */
        select: function (filter) {
            if (filter === null || filter === undefined) {
                return _.filter(this.rows, function (r) {
                    return r.getRow().state !== $rowState.deleted;

                });
            }
            if (filter) {
                if (filter.isTrue) {
                    //console.log("always true: returning this.rows");
                    return this.rows;
                }
                if (filter.isFalse) {
                    //console.log("always false: returning []");
                    return [];
                }
            }
            return _.filter(this.rows, function (r) {
                //console.log('actually filtering by '+filter);
                if (r.getRow().state === $rowState.deleted) {
                    //console.log("skipping a deleted row");
                    return false;
                }
                if (filter) {
                    //console.log('filter(r) is '+filter(r));
                    //noinspection JSValidateTypes   because a sqlFun is also a Function
                    return filter(r);
                }
                return true;
            });
        },

        /**
         * Extract a set of rows matching a filter function - including deleted rows
         * @method selectAll
         * @param {sqlFun} filter
         * @returns {ObjectRow[]}
         */
        selectAll: function (filter) {
            if (filter) {
                return _.filter(this.rows, filter);
            }
            return this.rows;
        },


        /**
         * Get the filter that compares key fields of a given row
         * @method keyFilter
         * @param {object} row
         * @returns {*|sqlFun}
         */
        keyFilter: function (row) {
            if (this.myKey.length === 0) {
                throw 'No primary key specified for table:' + this.name + ' and keyFilter was invoked.';
            }
            return dataQuery.mcmp(this.myKey, row);
        },

        /**
         * Compares the key of two objects
         * @param {object} a
         * @param {object} b
         * @returns {boolean}
         */
        sameKey: function (a, b) {
            return _.find(this.myKey, function (k) {
                return a[k] !== b[k];
            }) !== undefined;
        },

        /**
         * Get/Set the primary key in a Jquery fashioned style. If k is given, the key is set, otherwise the existing
         *  key is returned
         * @method key
         * @param {string[]} [k]
         * @returns {*|string[]}
         */
        key: function (k) {
            if (k === undefined) {
                return this.myKey;
            }
            if (_.isArray(k)) {
                this.myKey = _.clone(k);
            }
            else {
                this.myKey = Array.prototype.slice.call(arguments);
            }
            _.forEach(this.columns,function(c){
               delete c.isPrimaryKey;
            });
            var self=this;
            _.forEach(this.myKey,function(k){
                if (!self.columns[k]){
                    return true;
                }
                self.columns[k].isPrimaryKey=true;
            });
            return this;
        },

        /**
         * Check if a column is key
         * @param {string} k
         * @returns {boolean}
         */
        isKey: function(k){
            if (k.isPrimaryKey){
                return true;
            }
            if (this.columns[k]){
                return this.columns[k].isPrimaryKey;
            }
            return this.myKey.indexOf(k)>=0;
        },
        /**
         * Clears the table detaching all rows.
         * @method clear
         */
        clear: function () {
            var dr;
            _.forEach(this.rows, function (row) {
                dr = row.getRow();
                dr.table = null;
                dr.detach();
            });
            this.rows.length = 0;
        },

        /**
         * Detaches a row from the table
         * @method detach
         * @param obj
         */
        detach: function (obj) {
            var i = this.rows.indexOf(obj),
                dr;
            if (i >= 0) {
                this.rows.splice(i, 1);
            }
            dr = obj.getRow();
            dr.table = null;
            dr.detach();
        },

        /**
         * Adds an object to the table setting the datarow in the state of "added"
         * @method add
         * @param obj plain object
         * @returns DataRow created
         */
        add: function (obj) {
            var dr = this.load(obj);
            if (dr.state === $rowState.unchanged) {
                dr.state = $rowState.added;
            }
            return dr;
        },

        /**
         * check if a row is present in the table. If there is  a key, it is used for finding the row,
         *  otherwise a ==== comparison is made
         * @method existingRow
         * @param obj
         * @return {DataRow | undefined}
         */
        existingRow: function (obj) {
            if (this.myKey.length === 0) {
                var i = this.rows.indexOf(obj);
                if (i === -1) {
                    return undefined;
                }
                return this.rows[i];
            }
            var arr = _.filter(this.rows, this.keyFilter(obj));
            if (arr.length === 0) {
                return undefined;
            }
            return arr[0];
        },

        /**
         * Adds an object to the table setting the datarow in the state of "unchanged"
         * @method load
         * @param {object} obj plain object to load in the table
         * @param {boolean} [safe=true] if false doesn't verify existence of row
         * @returns {DataRow} created DataRow
         */
        load: function (obj, safe) {
            var dr, oldRow;
            if (safe || safe === undefined) {
                oldRow = this.existingRow(obj);
                if (oldRow) {
                    return oldRow.getRow();
                }
            }
            dr = new DataRow(obj);
            dr.table = this;
            this.rows.push(obj);
            return dr;
        },

        /**
         * Adds an object to the table setting the datarow in the state of 'unchanged'
         * @method loadArray
         * @param {object[]} arr array of plain objects
         * @param {boolean} safe if false doesn't verify existence of row
         * @return *
         */
        loadArray: function (arr, safe) {
            var that = this;
            _.forEach(arr, function (o) {
                that.load(o, safe);
            });
        },

        /**
         * Accept any changes setting all dataRows in the state of 'unchanged'.
         * Deleted rows become detached and are removed from the table
         * @method acceptChanges
         */
        acceptChanges: function () {
            //First detach all deleted rows
            var newRows = [];
            _.forEach(this.rows,
                /**
                 * @type {ObjectRow}
                 * @param o
                 */
                function (o) {
                var dr = o.getRow();
                if (dr.state === $rowState.deleted) {
                    dr.table = null;
                    dr.detach();
                }
                else {
                    dr.acceptChanges();
                    newRows.push(o);
                }
            });
            this.rows = newRows;
        },

        /**
         * Reject any changes putting all to 'unchanged' state.
         * Added rows become detached.
         * @method rejectChanges
         */
        rejectChanges: function () {
            //First detach all added rows
            var newRows = [];
            _(this.rows).forEach(
                /**
                 * @method
                 * @param {ObjectRow} o
                 */
                function (o) {
                    var dr = o.getRow();
                    if (dr.state === $rowState.added) {
                        dr.table = null;
                        dr.detach();
                    }
                    else {
                        dr.rejectChanges();
                        newRows.push(o);
                    }
                });
            this.rows = newRows;
        },

        /**
         * Check if any DataRow in the table has changes
         * @method hasChanges
         * @returns {boolean}
         */
        hasChanges: function () {
            return _.some(this.rows, function (o) {
                return o.getRow().state !== $rowState.unchanged;
            });

        },

        /**
         * gets an array of all modified/added/deleted rows
         * @method getChanges
         * @returns {Array}
         */
        getChanges: function () {
            return _.filter(this.rows, function (o) {
                return o.getRow().state !== $rowState.unchanged;
            });
        },

        /**
         * Debug-helper function
         * @method toString
         * @returns {string}
         */
        toString: function () {
            return "DataTable " + this.name;
        },

        /**
         * import a row preserving it's state, the row should already have a DataRow attached
         * @method importRow
         * @param {object} row input
         * @returns {DataRow} created
         */
        importRow: function (row) {
            var dr = row.getRow(),
                newR,
                newDr;
            dr.commit();
            newR = {};
            _.forOwn(row, function (val, key) {
                newR[key] = val;
            });
            newDr = new DataRow(newR);  //this creates an observer on newR
            newDr.state = dr.state;
            newDr.old = _.clone(dr.old, true);
            newDr.added = _.clone(dr.added, true);
            newDr.removed = _.clone(dr.removed, true);
            this.rows.push(newR);
            return newDr;
        },
        /**1212
         * Get/set the object defaults in a JQuery fashioned style. When def is present, its fields and values are
         *  merged into existent defaults.
         * @method defaults
         * @param [def]
         * @returns {object|*}
         */
        defaults: function (def) {
            if (def === undefined) {
                return this.myDefaults;
            }
            _.assign(this.myDefaults, def);
            return this;
        },

        /**
         * Clears any stored default value for the table
         * @method clearDefaults
         */
        clearDefaults: function () {
            this.myDefaults = {};
        },

        /**
         * creates a DataRow and returns the created object. The created object has the default values merged to the
         *  values in the optional parameter obj.
         * @method newRow
         * @param {object} [obj] contains the initial value of the created objects.
         * @param {ObjectRow} [parentRow]
         * @returns {object}
         */
        newRow: function (obj, parentRow) {
            var n = {};
            _.assign(n, this.myDefaults);
            if (_.isObject(obj)) {
                _.assign(n, obj);
            }
            if (parentRow !== undefined) {
                this.makeChild(n, parentRow.getRow().table.name, parentRow);
            }
            this.calcTemporaryId(n);
            this.add(n);
            return n;
        },

        /**
         * Make childRow child of parentRow if a relation between the two is found
         * @method makeChild
         * @param {object} childRow
         * @param {string} parentTable
         * @param {ObjectRow} [parentRow]
         */
        makeChild: function (childRow, parentTable, parentRow) {
            var that = this,
                parentRel = _.find(this.dataset.relationsByParent[parentTable],
                    function (rel) {
                        return rel.childTable === that.name;
                    });
            if (parentRel === undefined) {
                return;
            }
            parentRel.makeChild(parentRow, childRow);

        },


        /**
         * Get/Set a flag indicating that this table is not subjected to security functions in a Jquery fashioned
         *  style
         * @method skipSecurity
         * @param {boolean} [arg]
         * @returns {*|boolean}
         */
        skipSecurity: function (arg) {
            if (arg === undefined) {
                if (this.hasOwnProperty('isSkipSecurity')) {
                    return this.isSkipSecurity;
                }
                return false;
            }
            this.isSkipSecurity = arg;
            return this;
        },

        /**
         * Get/Set a flag indicating that this table is not subjected to the Insert and Copy function
         * @method skipInsertCopy
         * @param {boolean} [arg]
         * @returns {*|boolean}
         */
        skipInsertCopy: function (arg) {
            if (arg === undefined) {
                if (this.hasOwnProperty('isSkipInsertCopy')) {
                    return this.isSkipInsertCopy;
                }
                return false;
            }
            this.isSkipInsertCopy = arg;
            return this;
        },

        /**
         * Get/Set a table name, that represents the view table associated to the table
         * @method viewTable
         * @param {string} [arg]
         * @returns {*|string}
         */
        viewTable: function (arg) {
            if (arg === undefined) {
                if (this.hasOwnProperty('myViewTable')) {
                    return this.myViewTable;
                }
                return false;
            }
            this.myViewTable = arg;
            return this;
        },

        /**
         * Get/Set a table name, that represents the real table associated to the table
         * @method realTable
         * @param {string} [arg]
         * @returns {*|string}
         */
        realTable: function (arg) {
            if (arg === undefined) {
                if (this.hasOwnProperty('myRealTable')) {
                    return this.myRealTable;
                }
                return false;
            }
            this.myRealTable = arg;
            return this;
        },

        /**
         * Get/Set the name of table  to be used to read data from database in a Jquery fashioned style
         * @method tableForReading
         * @param {string} [tableName]
         * @returns {*|DataTable.myTableForReading|DataTable.name}
         */
        tableForReading: function (tableName) {
            if (tableName === undefined) {
                return this.myTableForReading || this.name;
            }
            this.myTableForReading = tableName;
            return this;
        },

        /**
         * Get/Set the name of table  to be used to write data from database in a Jquery fashioned style
         * @method tableForWriting
         * @param {string} [tableName]
         * @returns {*|DataTable.myTableForWriting|DataTable.name}
         */
        tableForWriting: function (tableName) {
            if (tableName === undefined) {
                return this.myTableForWriting || this.name;
            }
            this.myTableForWriting = tableName;
            return this;
        },

        /**
         * Get/Set a static filter  to be used to read data from database in a Jquery fashioned style
         * @method staticFilter
         * @param {sqlFun} [filter]
         * @returns {sqlFun}
         */
        staticFilter: function (filter) {
            if (filter === undefined) {
                return this.myStaticFilter;
            }
            this.myStaticFilter = filter;
        },

        /**
         * Get/set the ordering that have to be user reading from db
         * @param [fieldList]
         * @returns {*}
         */
        orderBy: function (fieldList) {
            if (fieldList === undefined) {
                return this.myOrderBy;
            }
            this.myOrderBy = fieldList;
            return this;
        },

        /**
         * get the list of columns or * if there is no column set
         * @method columnList
         * @returns string
         */
        columnList: function () {
            var c = _.map(
                this.columns,
                function (c) {
                    return c.name;
                }
            );
            if (c.length > 0) {
                return c.join(",");
            }
            return '*';
        },

        /**
         * Gets all autoincrement column names of this table
         * @method getAutoIncrementColumns
         * @returns {string[]}
         */
        getAutoIncrementColumns: function () {
            return _.keys(this.autoIncrementColumns);
        },

        /**
         * Get/Set autoincrement properties of fields
         * @method autoIncrement
         * @param {string} fieldName
         * @param {object} [autoIncrementInfo] //see AutoIncrementColumn properties for details
         * @returns {*|AutoIncrementColumn}
         */
        autoIncrement: function (fieldName, autoIncrementInfo) {
            if (autoIncrementInfo !== undefined) {
                this.autoIncrementColumns[fieldName] = new AutoIncrementColumn(fieldName, autoIncrementInfo);
                return this;
            }
            else {
                return this.autoIncrementColumns[fieldName];
            }
        },

        /**
         * Get a serializable version of this table. If serializeStructure=true, also structure information is serialized
         * @param {boolean} [serializeStructure=false]
         * @param {function} [filterRow] optional function for filtering rows to serialize
         * @return {object} the serialization object derived from this DataTable
         */
        serialize: function (serializeStructure, filterRow) {
            var clean= function (r){
                return _.pickBy(r,function(o){return o!==null && o!==undefined;});
            };
            var t = {};
            if (serializeStructure) {
                t.key = this.key().join();
                t.tableForReading = this.tableForReading();
                t.tableForWriting = this.tableForWriting();
                t.isCached = this.isCached;
                t.isTemporaryTable = this.isTemporaryTable;
                t.orderBy = this.orderBy();

                //t.staticFilter(this.staticFilter());
                if (this.staticFilter()) {
                    t.staticFilter=dataQuery.toObject(this.staticFilter());
                }
                t.skipSecurity = this.skipSecurity();
                t.skipInsertCopy = this.skipInsertCopy();
                t.realTable = this.realTable();
                t.viewTable = this.viewTable();
                t.defaults = this.defaults();
                t.autoIncrementColumns = this.autoIncrementColumns;
                t.columns = {};

                var o = {};
                _.forOwn(this.columns, function (val, key) {                   
                    o = {};
                    _.forOwn(val, function (v, k) {
                        if ((k === 'expression') && (_.isFunction(v) || _.isArray(v))) {
                            o[k] = jsDataQuery.toObject(v);
                        } else {
                            o[k] = v;
                        }
                    });
                    t.columns[key] = o;
                });
            }
            t.name= this.name;
            t.rows = [];
            _.forEach(this.rows, function (r) {
                if (filterRow && filterRow(r) === false) {
                    return; //skip this row
                }
                var row = r.getRow(),
                    rowState = row.state,
                    newRow = {state: rowState};
                row.commit();
                if (rowState === $rowState.deleted || rowState === $rowState.unchanged || rowState === $rowState.modified) {
                    newRow.old = clean(row.originalRow());
                }
                if (rowState === $rowState.modified || rowState === $rowState.added) {
                    newRow.curr = clean(r); //_.clone(r)
                }

                t.rows.push(newRow);
            });
            return t;
        },

        /**
         * Get data from a serialized structure. If serializeStructure=true, also structure information is serialized
         * @param {object} t
         * @param {boolean} [deserializeStructure=false]
         * @return {*}
         */
        deSerialize: function (t, deserializeStructure) {
            var that = this;
            if (deserializeStructure) {

                this.tableForReading(t.tableForReading);
                this.tableForWriting(t.tableForWriting);
                this.isCached = t.isCached;
                this.isTemporaryTable = t.isTemporaryTable;

                this.skipSecurity(t.skipSecurity);
                this.skipInsertCopy(t.skipInsertCopy);
                this.realTable(t.realTable);
                this.viewTable(t.viewTable);
                this.defaults(t.defaults);
                this.orderBy(t.orderBy);
                if (t.staticFilter) {
                    this.staticFilter(dataQuery.fromObject(t.staticFilter));
                }
                _.forEach(t.autoIncrementColumns, function (aiObj) {
                    var columnName = aiObj.columnName;

                    var options  = _.pick(aiObj, ['prefixField', 'linearField', 'idLen', 'middleConst', 'selector', 'selectorMask', 'minimum']);

                    that.autoIncrementColumns[columnName] = new AutoIncrementColumn(columnName, options);
                });
                if (t.columns) {
                    var o = {};
                    that.columns = {}
                    _.forOwn(t.columns, function (val, key) {
                        o = {};
                        _.forOwn(val, function (v, k) {
                            if (k === 'expression' && _.isObject(v)) {
                                o.expression = jsDataQuery.fromObject(v);
                            } else {
                                o[k] = v;
                            }
                        });
                        that.columns[key] = o;
                    });
                }

                this.key(t.key.split(','));
            }

            that.name=this.name;
            _.forEach(t.rows, function (r) {
                var rowState = r.state;
                if (rowState === $rowState.added) {
                    that.add(r.curr);
                    return;
                }
                var newRow = that.load(r.old); //newRow is unchanged
                if (rowState === $rowState.deleted) {
                    newRow.del();
                    return;
                }
                if (rowState === $rowState.modified) {
                    newRow.acceptChanges();
                    newRow.makeEqualTo(r.curr);
                }
            });
        },


        /**
         * Get all relation where THIS table is the child and another table is the parent
         * @method parentRelations
         * @returns {DataRelation[]}
         */
        parentRelations: function () {
            return this.dataset.relationsByChild[this.name];
        },

        /**
         * Get all relation where THIS table is the parent and another table is the child
         * @method childRelations
         * @returns {DataRelation[]}
         */
        childRelations: function () {
            return this.dataset.relationsByParent[this.name];
        },

        /**
         * adds an array of objects to collection, as unchanged, if they still are not present. Existence is verified
         *  basing on  key
         * @method mergeArray
         * @param {ObjectRow []} arr
         * @param {boolean} overwrite
         * @return {*}
         */
        mergeArray: function (arr, overwrite) {
            var that = this;
            _.forEach(arr, function (r) {
                    var oldRow = that.existingRow(r);
                    if (oldRow) {
                        if (overwrite) {
                            oldRow.getRow().makeEqualTo(r);
                            oldRow.acceptChanges();
                        }
                    }
                    else {
                        that.load(r, false);
                    }
                }
            );
        },

        /**
         * clones table structure without copying any DataRow
         * @method clone
         * @return {DataTable}
         */
        clone: function () {
            var cloned = new DataTable(this.name);
            cloned.key(this.key());
            cloned.tableForReading(this.tableForReading());
            cloned.tableForWriting(this.tableForWriting());
            cloned.staticFilter(this.staticFilter());
            cloned.skipSecurity(this.skipSecurity());
            cloned.skipInsertCopy(this.skipInsertCopy());
            cloned.realTable(this.realTable());
            cloned.viewTable(this.viewTable());
            cloned.defaults(this.defaults());
            cloned.autoIncrementColumns = _.clone(this.autoIncrementColumns);
            cloned.columns = _.clone(this.columns);
            cloned.orderBy(this.orderBy());
            return cloned;
        },

        /**
         * Clones table structure and copies data
         * method @copy
         * @return {DataTable}
         */
        copy: function () {
            var cloned = this.clone();
            _.forEach(this.rows, function (row) {
                cloned.importRow(row);
            });
        },


        /**
         * Gets a filter of colliding rows supposing to change r[field]= value, on  a specified column
         * @method collisionFilter
         * @private
         * @param {ObjectRow} r
         * @param {string} field
         * @param {object} value
         * @param {AutoIncrementColumn} autoInfo
         * @return {sqlFun}
         */
        collisionFilter: function (r, field, value, autoInfo) {
            var fields = [autoInfo.columnName].concat(autoInfo.selector),
                values = _.map(fields, function (k) {
                    if (k !== field) {
                        return r[k];
                    }
                    return value;
                });
            return dataQuery.mcmp(fields, values);
        },

        /**
         * Assign a field assuring it will not cause duplicates on table's autoincrement fields
         * @method safeAssign
         * @param {ObjectRow} r
         * @param {string} field
         * @param {object} value
         * @return {*}
         */
        safeAssign: function (r, field, value) {
            this.avoidCollisions(r, field, value);
            this.assignField(r, field, value);
        },

        /**
         * check if changing a key field of a row it would collide with come autoincrement field. If it would,
         *  recalculates colliding rows/filter in accordance
         * @method avoidCollisions
         * @param {ObjectRow} r
         * @param {string} field
         * @param {object} value
         */
        avoidCollisions: function (r, field, value) {
            var that = this;
            var deps = this.fieldDependencies(field);
            if (this.autoIncrementColumns[field]) {
                deps.unshift(field);
            }
            _.forEach(deps, function (depField) {
                that.avoidCollisionsOnField(depField,
                    that.collisionFilter(r, field, value, that.autoIncrementColumns[depField]));
            });


        },

        /**
         * Recalc a field to avoid collisions on some rows identified by a filter
         * @method avoidCollisionsOnField
         * @private
         * @param {string} field
         * @param {sqlFun} filter
         */
        avoidCollisionsOnField: function (field, filter) {
            var that = this;
            _.forEach(this.select(filter), function (rCollide) {
                that.calcTemporaryId(rCollide, field);
            });
        },

        /**
         * Assign a value to a field and update all dependencies
         * @method assignField
         * @param {ObjectRow} r
         * @param {string} field
         * @param {object} value
         */
        assignField: function (r, field, value) {
            this.cascadeAssignField(r, field, value); //change all child field
            r[field] = value;
            this.updateDependencies(r, field); //change all related field
        },

        /**
         * assign a value to a field in a row and all descending child rows
         * @method cascadeAssignField
         * @private
         * @param {ObjectRow} r
         * @param {string} parentField
         * @param {object} value
         */
        cascadeAssignField: function (r, parentField, value) {
            var ds = this.dataset;
            _.forEach(ds.relationsByParent[this.name], function (rel) {
                var pos = _.indexOf(rel.parentCols, parentField);
                if (pos >= 0) {
                    var childField = rel.childCols[pos];
                    _.forEach(rel.getChilds(r), function (childRow) {
                        var childTable = ds.tables[rel.childTable];
                        childTable.cascadeAssignField(childRow, childField, value);

                        childRow[childField] = value;
                        childTable.updateDependencies(childRow, childField);
                    });
                }
            });
        },

        /**
         * Gets all autoincrement fields that depends on a given field, i.e. those having field as selector or prefixfield
         * @method fieldDependencies
         * @private
         * @param {string} field
         * @return {string[]}
         */
        fieldDependencies: function (field) {
            var res = [];
            _.forEach(_.values(this.autoIncrementColumns), function (autoInfo) {
                    if (autoInfo.prefixField === field) {
                        res.push(autoInfo.columnName);
                        return;
                    }
                    if (autoInfo.selector && _.indexOf(autoInfo.selector, field) >= 0) {
                        res.push(autoInfo.columnName);
                    }
                }
            );
            return res;
        },

        /**
         * Re calculate temporaryID affected by a field change. It should be done for every autoincrement field
         *  that has that field as a selector or as a prefix field
         * @method updateDependencies
         * @param {ObjectRow} row
         * @param {string} field
         * @returns {*}
         */
        updateDependencies: function (row, field) {
            var that = this;
            _.forEach(this.fieldDependencies(field), function (f) {
                that.calcTemporaryId(row, f);
            });
        },


        /**
         * Augment r[field] in order to avoid collision with another row that needs to take that value
         * if field is not specified, this is applied to all autoincrement field of the table
         * Precondition: r[[field] should be an autoincrement field
         * @method calcTemporaryId
         * @param {ObjectRow} r
         * @param {string} [field]
         */
        calcTemporaryId: function (r, field) {
            var that = this;
            if (field === undefined) {
                _.forEach(_.keys(this.autoIncrementColumns), function (field) {
                    that.calcTemporaryId(r, field);
                });
                return;
            }
            var prefix = '',
                newID = '1',
                evaluatedMax,
                autoIncrementInfo = this.autoIncrementColumns[field],
                selector = autoIncrementInfo.getSelector(r),
                startSearch;
            if (autoIncrementInfo.isNumber) {
                evaluatedMax = this.cachedMaxSubstring(field, 0, 0, selector) + 1;
            }
            else {
                prefix = autoIncrementInfo.getPrefix(r);
                startSearch = prefix.length + 1;
                evaluatedMax = this.cachedMaxSubstring(field, startSearch, autoIncrementInfo.idLen, selector) + 1;
            }

            if (autoIncrementInfo.isNumber) {
                newID = evaluatedMax;
            }
            else {

                newID = evaluatedMax.toString();
                if (autoIncrementInfo.idLen > 0) {
                    while (newID.length < autoIncrementInfo.idLen) {
                        newID = '0' + newID;
                    }
                }
                newID = prefix + newID;
            }

            this.assignField(r, field, newID);

        },
        /**
         * merges changes from dataTable t assuming they are unchanged and they can be present in this or not.
         * If a row is not present, it is added. If it is present, it is updated.
         * It is assumed that "this" dataTable is unchanged at the beginning
         * @method mergeAsPut
         * @param {DataTable} t
         */
        mergeAsPut: function (t) {
            var that = this;
            _.forEach(t.rows, function (r) {
                var existingRow = that.select(that.keyFilter(r));
                if (existingRow.length === 0) {
                    that.add(_.clone(r.current));  // new row state is 'added'
                }
                else {
                    existingRow[0].getRow().makeEqualTo(r.current); //new row state is modified
                }
            });
        },

        /**
         * merges changes from dataTable t assuming they are unchanged and they are not present in this dataTable.
         * Rows are all added 'as is' to this, in the state of ADDED
         * It is assumed that "this" dataTable is unchanged at the beginning
         * @method mergeAsPost
         * @param {DataTable} t
         */
        mergeAsPost: function (t) {
            var that = this;
            _.forEach(t.rows, function (r) {
                that.add(_.clone(r.current)); //row is always simply  added
            });
        },

        /**
         * merges changes from dataTable t assuming they are unchanged and they are all present in this dataTable.
         * Rows are updated, but only  fields actually present in d are modified. Other field are left unchanged.
         * It is assumed that "this" dataTable is unchanged at the beginning
         * @method mergeAsPatch
         * @param {DataTable} t
         */
        mergeAsPatch: function (t) {
            var that = this;
            _.forEach(t.rows, function (r) {
                var existingRow = that.select(t.keyFilter(r));
                if (existingRow.length === 1) {
                    existingRow[0].getRow().patchTo(r); //row is now in the state of updated
                }
            });
        },

        /**
         * merge any row present in dataTable t. Rows are merged as unchanged if they are unchanged,
         *  otherwise their values are copied into existent dataTable
         *  DataSet must have same table structure
         * @param  {DataTable} t
         */
        merge: function (t) {
            var that = this;
            _.forEach(t.rows, function (r) {
                var existingRow = that.select(t.keyFilter(r));
                if (r.getRow().state === $rowState.deleted) {
                    if (existingRow.length === 1) {
                        existingRow[0].makeSameAs(r.getRow());
                    }
                    else {
                        that.add(_.clone(r.getRow())).acceptChanges().del();
                    }
                }
                else {
                    if (existingRow.length === 1) {
                        existingRow[0].getRow().makeSameAs(r.getRow());
                    }
                    else {
                        that.add({}).makeSameAs(r.getRow());
                    }
                }
            });
        }

    };

    /**
     * Provides shim for Ado.net DataSet class
     * @module DataSet
     */

    /**
     * Manages auto fill of locking purposed fields and evaluates filter for optimistic locking for update
     * In his basic implementation accept a list of fields to fill. Values for filling are taken from
     *  environment.
     * @class  OptimisticLocking
     */
    /**
     * @method OptimisticLocking
     * @param {string[]} updateFields Fields to fill and to check during update operations
     * @param {string[]} createFields Fields to fill and to check during insert operations
     * @constructor
     */
    function OptimisticLocking(updateFields, createFields) {
        this.updateFields = updateFields || [];
        this.createFields = createFields || [];
    }

    OptimisticLocking.prototype = {
        constructor: OptimisticLocking,

        /**
         * This function is called before posting row into db for every insert/update
         * @method prepareForPosting
         * @param {ObjectRow} r
         * @param {Environment} env
         */
        prepareForPosting: function (r, env) {
            var row = r.getRow();
            if (row.state === $rowState.added) {
                _.forEach(this.createFields, function (field) {
                    //noinspection JSUnresolvedFunction
                    r[field] = env.field(field);
                });
                return;
            }
            if (row.state === $rowState.modified) {
                _.forEach(this.updateFields, function (field) {
                    //noinspection JSUnresolvedFunction
                    r[field] = env.field(field);
                });
            }
        },

        /**
         * Get the optimistic lock for updating or deleting a row
         * @method getOptimisticLock
         * @param {ObjectRow}r
         * @returns {sqlFun}
         */
        getOptimisticLock: function (r) {
            var row = r.getRow(),
                fields,
                key = row.table.key();
            if (key.length !== 0) {
                fields = key.concat(this.updateFields);
                return dataQuery.mcmp(fields,
                    _.map(fields, function (f) {
                        return row.getValue(f, $rowVersion.original);
                    })
                );
            }
            return dataQuery.mcmp(_.keys(r), r);
        }
    };


    /**
     * Describe a relation between two DataTables of a DataSet.
     * @class DataRelation
     */


    /**
     * creates a DataRelation
     * @class DataRelation
     * @constructor DataRelation
     * @param {string} relationName
     * @param {string} parentTableName
     * @param {String|String[]} parentColsName array of string
     * @param {string} childTableName
     * @param {String|String[]} [childColsName=parentColsName] optional names of child columns
     * @return {DataRelation}
     */
    function DataRelation(relationName, parentTableName, parentColsName, childTableName, childColsName) {
        this.name = relationName;
        /**
         * Parent table name
         * @property parentTable
         * @type string
         */
        this.parentTable = parentTableName;

        /**
         * DataSet to which this DataRelation belongs to. It is used to retrieve parent and child table
         * @property dataSet
         * @type DataSet
         */
        this.dataset = null;

        /**
         * Array of parent column names or comma separated column names
         * @property parentCols
         * @type String|String[]
         */
        this.parentCols = _.isString(parentColsName) ?
            _.map(parentColsName.split(','), function (s) {
                return s.trim();
            })
            : _.clone(parentColsName);

        /**
         * Child table name
         * @property childTable
         * @type string
         */
        this.childTable = childTableName;

        /**
         * Array of child column names  or comma separated column names
         * @property childCols
         * @type string|string[]
         */
        if (childColsName) {
            this.childCols = _.isString(childColsName) ?
                _.map(childColsName.split(','), function (s) {
                    return s.trim();
                })
                : _.clone(childColsName);
        }
        else {
            this.childCols = this.parentCols;
        }
    }

    DataRelation.prototype = {
        /**
         * Gets a filter that will be applied to the child table and will find any child row of a given ObjectRow
         * @method getChildsFilter
         * @param {ObjectRow} parentRow
         * @param {string} [alias] when present is used to attach an alias for the parent table in the composed filter
         */
        getChildsFilter: function (parentRow, alias) {
            var that = this;
            return dataQuery.mcmp(that.childCols,
                _.map(that.parentCols, function (col) {
                    return parentRow[col];
                }),
                alias
            );
        },

        /**
         * Get any child of a given ObjectRow following this DataRelation
         * @method getChilds
         * @param {ObjectRow} parentRow
         * @returns {ObjectRow[]}
         */
        getChilds: function (parentRow) {
            var ds = this.dataset;
            if (ds === null) {
                ds = parentRow.getRow().table.dataset;
            }
            var childTable = ds.tables[this.childTable];
            return _.filter(childTable.rows, this.getChildsFilter(parentRow));
        },

        /**
         * Gets a filter that will be applied to the parent table and will find any parent row of a given ObjectRow
         * @method getParentsFilter
         * @param {object} childRow
         * @param {string} [alias] when present is used to attach an alias for the parent table in the composed filter
         */
        getParentsFilter: function (childRow, alias) {
            var that = this;
            return dataQuery.mcmp(that.parentCols,
                _.map(that.childCols, function (col) {
                    return childRow[col];
                }),
                alias
            );
        },


        /**
         * Get any parent of a given ObjectRow following this DataRelation
         * @method getParents
         * @param {ObjectRow} childRow
         * @returns {ObjectRow[]}
         */
        getParents: function (childRow) {
            var ds = this.dataset;
            if (ds === null) {
                ds = childRow.getRow().table.dataset;
            }
            var actualParentTable = ds.tables[this.parentTable];
            return _.filter(actualParentTable.rows, this.getParentsFilter(childRow));
        },

        /**
         * Get a serialized version of this relation
         * @returns {{}}
         */
        serialize: function () {
            var rel = {};
			var sep = ",";
            //relation name is not serialized here, it is a key in the parent
            rel.parentTable = this.parentTable;
            //parent cols are serialized as a comma separated field list
            rel.parentCols = this.parentCols.join(sep);
            rel.childTable = this.childTable;
            //child cols are not serialized if are same as parent cols
            if (this.childCols !== this.parentCols) {
                rel.childCols = this.childCols.join(sep);
            }
            return rel;
        },

        deSerialize: function (rel) {
			var sep = ",";
            //relation name is not serialized here, it is a key in the parent
            this.parentTable = rel.parentTable;
            //parent cols are serialized as a comma separated field list
            this.parentCols = rel.parentCols.split(sep);
            this.childTable = rel.childTable;
            //child cols are not serialized if are same as parent cols
            if (rel.childCols) {
                this.childCols = rel.childCols.split(sep);
            }
            else {
                this.childCols = rel.parentCols.split(sep);
            }
        },

        /**
         * get/set the activation filter for the relation, i.e. a condition that must be satisfied in order to
         *  follow the relation when automatically filling dataset from database. The condition is meant to be applied
         *  to parent rows
         * @param {sqlFun} [filter]
         * @returns {*}
         */
        activationFilter: function (filter) {
            if (filter) {
                this.myActivationFilter = filter;
            }
            else {
                return this.myActivationFilter;
            }
        },

        /**
         * Establish if  a relation links the key of  a table into a subset of another table key
         * @method isEntityRelation
         * @returns {boolean}
         */
        isEntityRelation: function () {
            var parent = this.dataset.tables[this.parentTable],
                parentKey = parent.key(),
                child = this.dataset.tables[this.childTable];
            if (parentKey.length !== this.parentCols.length) {
                return false;
            }
            //parent columns must be the key for parent table
            if (_.difference(parentKey, this.parentCols).length !== 0) {
                return false;
            }
            //child columns must be a subset of the child table key
            if (_.difference(this.childCols, child.key()).length > 0) {
                return false;
            }
            return true;
        },

        /**
         * Modifies childRow in order to make it child of parentRow. Sets to null corresponding fields if
         *  parentRow is null or undefined
         * @method makeChild
         * @param {ObjectRow} parentRow
         * @param {ObjectRow} childRow
         * @return {*}
         */
        makeChild: function (parentRow, childRow) {
            _.each(_.map(
                _.zip(this.parentCols, this.childCols),
                _.curry(_.zipObject)(['parentCol', 'childCol'])
                ),
                function (pair) {
                    if (parentRow === undefined || parentRow === null) {
                        childRow[pair.childCol] = null;
                    }
                    else {
                        childRow[pair.childCol] = parentRow[pair.parentCol];
                    }
                });

            // _.forEach(_.zip(this.parentCols,this.childCols),function(colPair){
            //     if (parentRow === undefined || parentRow === null) {
            //         childRow[colPair[1]] = null;
            //     }
            //     else {
            //         childRow[colPair[1]] = parentRow[colPair[0]];
            //     }
            // });
        }
    };


    /**
     * Stores and manages a set of DataTables and DataRelations
     * @class DataSet
     */

    /**
     * Creates an empty DataSet
     * @method DataSet
     * @param {string} dataSetName
     * @returns {DataSet}
     * @constructor
     */
    function DataSet(dataSetName) {
        if (this.constructor !== DataSet) {
            return new DataSet(dataSetName);
        }
        /**
         * DataSet name
         * @property name
         */
        this.name = dataSetName;


        /**
         * Collection of DataTable where tables[tableName] is a DataTable named tableName
         * @property {Hash} tables
         */
        this.tables = {};


        /**
         * Collection of DataRelation  where relations[relName] is a DataRelation named relName
         * @property {Hash} relations
         */
        this.relations = {};

        /**
         * Gets all relations where the parent table is the key of the hash
         * relationsByParent['a'] is an array of all DataRelations where 'a' is the parent
         * @property relationsByParent
         * @type DataRelation[][]
         */
        this.relationsByParent = {};

        /**
         * Gets all relations where the child table is the key of the hash
         * relationsByChild['a'] is an array of all DataRelations where 'a' is the child
         * @property relationsByChild
         * @type DataRelation[][]
         */
        this.relationsByChild = {};

        /**
         * DataSet - level optmistic locking, this property is set in custom implementations
         * @property {OptimisticLocking} optimisticLocking
         */
    }


    DataSet.prototype = {
        constructor: DataSet,
        toString: function () {
            return "dataSet " + this.name;
        },

        getParentChildRelation: function (parentName, childName) {
            return _(this.relationsByChild[childName])
                .filter({parentTable: parentName})
                .value();
        },
        /**
         * Clones a DataSet replicating its structure but without copying any ObjectRow
         * @method clone
         * @returns {DataSet}
         */
        clone: function () {
            var newDs = new DataSet(this.name);
            newDs.optimisticLocking = this.optimisticLocking;
            _.forEach(this.tables, function (t) {
                var newT = t.clone();
                newT.dataset = newDs;
                newDs.tables[newT.name] = newT;
                newDs.relationsByChild[newT.name] = [];
                newDs.relationsByParent[newT.name] = [];
            });
            _.forEach(this.relations, function (r) {
                newDs.newRelation(r.name, r.parentTable, r.parentCols, r.childTable, r.childCols);
            });
            return newDs;
        },

        /**
         * Creates a new DataTable attaching it to the DataSet
         * @method newTable
         * @param {string} tableName
         * @returns {DataTable}
         */
        newTable: function (tableName) {
            if (this.tables[tableName]) {
                throw ("Table " + tableName + " is already present in dataset");
            }
            var t = new DataTable(tableName);
            t.dataset = this;
            this.tables[tableName] = t;
            this.relationsByChild[tableName] = [];
            this.relationsByParent[tableName] = [];
            return t;
        },

        /**
         * Creates a copy of the DataSet, including both structure and data.
         * @method copy
         * @returns {DataSet}
         */
        copy: function () {
            var newDS = this.clone();
            _.forEach(this.tables, function (t) {
                var newT = newDS.tables[t.name];
                _.forEach(t.rows, function (r) {
                    newT.importRow(r);
                });
            });
            return newDS;
        },

        /**
         * Calls acceptChanges to all contained DataTables
         * @method acceptChanges
         */
        acceptChanges: function () {
            _.forEach(this.tables, function (t) {
                t.acceptChanges();
            });
        },

        /**
         * Calls rejectChanges to all contained DataTables
         * @method rejectChanges
         */
        rejectChanges: function () {
            _.forEach(this.tables, function (t) {
                t.rejectChanges();
            });
        },

        /**
         * Check if any contained DataTable has any changes
         * @method hasChanges
         * @returns {boolean}
         */
        hasChanges: function () {
            return _.some(this.tables, function (t) {
                return t.hasChanges();
            });
        },

        /**
         * Creates a new DataRelation and attaches it to the DataSet
         * @method newRelation
         * @param {string} relationName
         * @param {string} parentTableName
         * @param {string[]} parentColsName array of string
         * @param {string} childTableName
         * @param {string[]} childColsName array of string
         * @return {DataRelation}
         */
        newRelation: function (relationName, parentTableName, parentColsName, childTableName, childColsName) {
            if (this.relations[relationName]) {
                throw ("Relation " + relationName + " is already present in dataset");
            }
            if (this.tables[parentTableName] === undefined) {
                throw ("Parent table:" + parentTableName + " of relation " + relationName + " is not a dataSet table");
            }
            if (this.tables[childTableName] === undefined) {
                throw ("Child table:" + childTableName + " of relation " + relationName + " is not a dataSet table");
            }

            var rel = new DataRelation(relationName, parentTableName, parentColsName, childTableName, childColsName);
            rel.dataset = this;
            this.relations[relationName] = rel;

            if (!this.relationsByParent[parentTableName]) {
                this.relationsByParent[parentTableName] = [];
            }
            this.relationsByParent[parentTableName].push(rel);


            if (!this.relationsByChild[childTableName]) {
                this.relationsByChild[childTableName] = [];
            }
            this.relationsByChild[childTableName].push(rel);

            return rel;
        },
        /**
         * Deletes a row with all subentity child
         * @method cascadeDelete
         * @param {ObjectRow} row
         * @return {*}
         */
        cascadeDelete: function (row) {
            var r = row.getRow(),
                table = r.table,
                that = this;
            _.forEach(this.relationsByParent[table.name], function (rel) {
                if (rel.isEntityRelation()) {
                    _.forEach(rel.getChilds(row), function (toDel) {
                        if (toDel.getRow().state !== $rowState.deleted) {
                            that.cascadeDelete(toDel);
                        }
                    });
                }
                else {
                    _.forEach(rel.getChilds(row), function (toUnlink) {
                            rel.makeChild(null, toUnlink);
                        }
                    );
                }
            });
            r.del();
        },

        /**
         * Creates a serializable version of this DataSet
         * @method serialize
         * @param {boolean} [serializeStructure=false] when true serialized also structure, when false only row data
         * @param {function} [filterRow] function to select which rows have to be serialized
         * @returns {object}
         */
        serialize: function (serializeStructure, filterRow) {
            var d = {},
                that = this;
            if (serializeStructure) {
                d.name = this.name;
                d.relations = {};
                _.forEach(_.keys(this.relations), function (relationName) {
                    d.relations[relationName] = that.relations[relationName].serialize();
                });
            }
            d.tables = {};
            _.forEach(_.keys(this.tables), function (tableName) {
                d.tables[tableName] = that.tables[tableName].serialize(serializeStructure, filterRow);
            });
            return d;
        },

        /**
         * Restores data from an object obtained with serialize().
         * @method deSerialize
         * @param {object} d
         * @param {boolean} deSerializeStructure
         */
        deSerialize: function (d, deSerializeStructure) {
            var that = this;
            if (deSerializeStructure) {
                this.name = d.name;
            }
            _.forEach(_.keys(d.tables), function (tableName) {
                var t = that.tables[tableName];
                if (t === undefined) {
                    t = that.newTable(tableName);
                }
                t.deSerialize(d.tables[tableName],deSerializeStructure);
            });
            if (deSerializeStructure) {
                _.forEach(_.keys(d.relations), function (relationName) {
                    var rel = d.relations[relationName],
                        newRel = that.newRelation(relationName, rel.parentTable, rel.parentCols, rel.childTable, rel.childCols);
                    newRel.deSerialize(rel);
                });
            }
        },

        /**
         * merges changes from DataSet d assuming they are unchanged and they can be present in this or not.
         * If a row is not present, it is added. If it is present, it is updated.
         * It is assumed that "this" dataset is unchanged at the beginning
         * @method mergeAsPut
         * @param {DataSet} d
         */
        mergeAsPut: function (d) {
            var that = this;
            _.forEach(d.tables, function (t) {
                that.tables[t.name].mergeAsPut(t);
            });
        },

        /**
         * merges changes from DataSet d assuming they are unchanged and they are not present in this dataset.
         * Rows are all added 'as is' to this, in the state of ADDED
         * It is assumed that "this" dataset is unchanged at the beginning
         * @method mergeAsPost
         * @param {DataSet} d
         */
        mergeAsPost: function (d) {
            var that = this;
            _.forEach(d.tables, function (t) {
                that.tables[t.name].mergeAsPost(t);
            });
        },

        /**
         * merges changes from DataSet d assuming they are unchanged and they are all present in this dataset.
         * Rows are updated, but only  fields actually present in d are modified. Other field are left unchanged.
         * It is assumed that "this" dataset is unchanged at the beginning
         * @method mergeAsPatch
         * @param {DataSet} d
         */
        mergeAsPatch: function (d) {
            var that = this;
            _.forEach(d.tables, function (t) {
                that.tables[t.name].mergeAsPatch(t);
            });
        },

        /**
         * merge any row present in dataset d. Rows are merged as unchanged if they are unchanged,
         *  otherwise their values are copied into existent dataset
         *  DataSet must have same table structure
         * @param d
         */
        merge: function (d) {
            var that = this;
            _.forEach(d.tables, function (t) {
                that.tables[t.name].merge(t);
            });
        },

        /**
         * Import data from a given dataset
         * @method importData
         * @param {DataSet}  d
         */
        importData: function (d) {
            this.mergeAsPost(d);
            this.acceptChanges();
        }
    };


    var jsDataSet = {
        dataRowState: $rowState,
        dataRowVersion: $rowVersion,
        DataColumn: DataColumn,
        DataRow: DataRow,
        DataTable: DataTable,
        DataSet: DataSet,
        toString: function () {
            return "dataSet Namespace";
        },
        OptimisticLocking: OptimisticLocking,
        myLoDash: _ //for testing purposes
    };


    // Some AMD build optimizers like r.js check for condition patterns like the following:
    //noinspection JSUnresolvedVariable
    if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
        // Expose lodash to the global object when an AMD loader is present to avoid
        // errors in cases where lodash is loaded by a script tag and not intended
        // as an AMD module. See http://requirejs.org/docs/errors.html#mismatch for
        // more details.
        root.jsDataSet = jsDataSet;

        // Define as an anonymous module so, through path mapping, it can be
        // referenced as the "underscore" module.
        //noinspection JSUnresolvedFunction
        define(function () {
            return jsDataSet;
        });
    }
    // Check for `exports` after `define` in case a build optimizer adds an `exports` object.
    else if (freeExports && freeModule) {
        // Export for Node.js or RingoJS.
        if (moduleExports) {
            (freeModule.exports = jsDataSet).jsDataSet = jsDataSet;
        }
        // Export for Narwhal or Rhino -require.
        else {
            freeExports.jsDataSet = jsDataSet;
        }
    }
    else {
        // Export for a browser or Rhino.
        root.jsDataSet = jsDataSet;
    }
}).call(this,
    (typeof _ === 'undefined') ? require('lodash') : _,
    (typeof ObjectObserver === 'undefined') ? require('observe-js').ObjectObserver : ObjectObserver,
    (typeof jsDataQuery === 'undefined') ? require('jsDataQuery').jsDataQuery : jsDataQuery
);

