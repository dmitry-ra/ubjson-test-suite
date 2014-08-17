'use strict';

var UbjsonTestSuiteCore = (function (core) {

//------------------------------------------------------------------------------

    var Types = {
        Null: 'Z',
        Noop: 'N',
        True: 'T',
        False: 'F',
        Int8: 'i',
        UInt8: 'U',
        Int16: 'I',
        Int32: 'l',
        Int64: 'L',
        Float32: 'd',
        Float64: 'D',
        HighNumber: 'H',
        Char: 'C',
        String: 'S',
        ArrayBegin: '[',
        ArrayEnd: ']',
        ObjectBegin: '{',
        ObjectEnd: '}',
        Type: '$',
        Count: '#'
    };
    core.Types = Types;

    var MinInt8 = -128;
    var MaxInt8 = 127;
    var MinUInt8 = 0;
    var MaxUInt8 = 255;
    var MinInt16 = -32768;
    var MaxInt16 = 32767;
    var MinInt32 = -2147483648;
    var MaxInt32 = 2147483647;
    var MinInt64 = -9223372036854775808;
    var MaxInt64 = 9223372036854775807;
    var MinFloat32 = -3.402823e38;
    var MaxFloat32 = 3.402823e+38;
    var MinFloat64 = -1.7976931348623157E+308;
    var MaxFloat64 = 1.7976931348623157E+308;

    var Semantics = {
        Markup: 1,
        Key: 2,
        Value: 3,
        ArrayItem: 4
    };
    core.BlockSemantics = Semantics;

//------------------------------------------------------------------------------

    function utf8encode(string) {
        return unescape(encodeURIComponent(string));
    }

    function isInteger(number) {
        return isFinite(number) &&
            number > -9007199254740992 &&
            number < 9007199254740992 &&
            Math.floor(number) === number;
    };

    function findSuitableNumericType(number) {
        if (isInteger(number)) {
            if (number >= MinInt8 && number <= MaxInt8)
                return Types.Int8;

            if (number >= MinUInt8 && number <= MaxUInt8)
                return Types.UInt8;

            if (number >= MinInt16 && number <= MaxInt16)
                return Types.Int16;

            if (number >= MinInt32 && number <= MaxInt32)
                return Types.Int32;

            if (number >= MinInt64 && number <= MaxInt64)
                return Types.Int64;
        } else {
            if (number >= MinFloat32 && number <= MaxFloat32)
                return Types.Float32;

            if (number >= MinFloat64 && number <= MaxFloat64)
                return Types.Float64;
        }
        return Types.HighNumber;
    }

//------------------------------------------------------------------------------

    function BlockItem() {
    }

    BlockItem.prototype.displayValue = null;

    BlockItem.prototype.toString = function() {
        return 'semantic: ' + this.semantic + ', type: ' + this.type;
    }

    function DataItem(semantic, type, value) {
        this.semantic = semantic;
        this.type = type;
        this.value = value;
    }

    DataItem.prototype = new BlockItem();
    DataItem.prototype.constructor = DataItem;

    function TagItem(semantic, type) {
        this.semantic = semantic;
        this.type = type;
    }

    TagItem.prototype = new BlockItem();
    TagItem.prototype.constructor = TagItem;

//------------------------------------------------------------------------------

    function ObjectSerializer() {
        this.items = [];
        this.currentSemantic = Semantics.Markup;
    }

    ObjectSerializer.prototype.serialize = function(rootObject) {
        this.items = [];
        if (rootObject instanceof Object) {
            this.serializeEntity(rootObject);
        } else {
            throw new Error('Root object must be an Array or Object instance');
        }
        return this.items;
    }

    ObjectSerializer.prototype.serializeEntity = function(entity) {
        if (entity == null) {
            this.addTagItem(Types.Null);
            return;
        }
        switch(typeof(entity)) {
            case 'object':
                if (entity instanceof Array) {
                    this.serializeArray(entity);
                } else {
                    this.serializeObject(entity);
                }
                break;
            case 'string':
                this.serializeString(entity, true, true);
                break;
            case 'number':
                this.serializeNumber(entity);
                break;
            case 'boolean':
                this.serializeBoolean(entity);
                break;
            default:
                throw new Error('Unknown type "' + typeof(entity) + '"');
        }
    }

    ObjectSerializer.prototype.serializeArray = function(array) {
        this.setCurrentSemantic(Semantics.Markup);
        this.addTagItem(Types.ArrayBegin);
        var count = array.length;
        for(var i = 0; i < count; i++) {
            this.setCurrentSemantic(Semantics.ArrayItem);
            this.serializeEntity(array[i]);
            this.items[this.items.length - 1].arrayItemTerminator = true;
        }
        this.setCurrentSemantic(Semantics.Markup);
        this.addTagItem(Types.ArrayEnd);
    }

    ObjectSerializer.prototype.serializeObject = function(object) {
        this.setCurrentSemantic(Semantics.Markup);
        this.addTagItem(Types.ObjectBegin);
        var keys = Object.keys(object);
        var count = keys.length;
        for(var i = 0; i < count; i++) {
            var key = keys[i];
            this.setCurrentSemantic(Semantics.Key);
            this.serializeString(key, false, false);
            this.setCurrentSemantic(Semantics.Value);
            this.serializeEntity(object[key]);
        }
        this.setCurrentSemantic(Semantics.Markup);
        this.addTagItem(Types.ObjectEnd);
    }

    ObjectSerializer.prototype.serializeString = function(string, emitStringType, charOptimization) {
        if (charOptimization && string.length == 1) {
            var ch = string.charCodeAt(0);
            if (ch < 128) {
                this.addTagItem(Types.Char);
                this.addDataItem(Types.Char, ch).displayValue = string;
                return;
            }
        }
        var utf8value = utf8encode(string);
        var size = utf8value.length;
        if (emitStringType) {
            this.addTagItem(Types.String);
        }
        this.serializeNumber(size);
        if (size > 0) {
            this.addDataItem(Types.String, utf8value).displayValue = string;
        }
    }

    ObjectSerializer.prototype.serializeNumber = function(number) {
        var type = findSuitableNumericType(number);
        this.addTagItem(type);
        this.addDataItem(type, number);
    }

    ObjectSerializer.prototype.serializeBoolean = function(bool) {
        if (bool) {
            this.addTagItem(Types.True);
        } else {
            this.addTagItem(Types.False);
        }
    }

    ObjectSerializer.prototype.addTagItem = function(type) {
        var item = new TagItem(this.currentSemantic, type);
        this.items.push(item);
        return item;
    }

    ObjectSerializer.prototype.addDataItem = function(type, value) {
        var item = new DataItem(this.currentSemantic, type, value);
        this.items.push(item);
        return item;
    }

    ObjectSerializer.prototype.setCurrentSemantic = function(semantic) {
        this.currentSemantic = semantic;
    }

//------------------------------------------------------------------------------

    function BlocksTextRenderer() {
        this.indentStep = '    ';
        this.formalized = false;
        this.highlight = true;
        this.styles = {
                markup: "color: green;",
                key: "color: blue",
                value: "color: red"
            };
    }

    BlocksTextRenderer.prototype.render = function(items) {
        var text = '';
        var indent = '';
        var nestingLevel = 0;
        var prevBlock = null;
        var count = items.length;
        var startNewLine = false;
        for (var i = 0; i < count; i++) {
            var block = items[i];
            if (block instanceof TagItem) {
                if (block.type == Types.ObjectEnd || block.type == Types.ArrayEnd) {
                    indent = this.getIndent(--nestingLevel);
                    startNewLine = prevBlock != null && prevBlock.type != Types.ObjectBegin && prevBlock.type != Types.ArrayBegin;
                }
                if (prevBlock != null) {
                    if (prevBlock.arrayItemTerminator) {
                        startNewLine = true;
                    }
                    if (prevBlock.semantic == Semantics.Value && block.semantic == Semantics.Key) {
                        startNewLine = true;
                    }
                    if (prevBlock.type == Types.ObjectEnd || prevBlock.type == Types.ArrayEnd) {
                        startNewLine = true;
                    }
                }
                if (startNewLine) {
                    text += '\n' + indent;
                    startNewLine = false;
                }
                text += this.renderTagBlock(block);
                if (block.type == Types.ObjectBegin || block.type == Types.ArrayBegin) {
                    indent = this.getIndent(++nestingLevel);
                    startNewLine = true;
                }
            } else {
                text += this.renderDataBlock(block);
            }
            prevBlock = block;
        }
        return text;
    }

    BlocksTextRenderer.prototype.renderTagBlock = function(block) {
        if (this.highlight) {
            var style = this.getStyle(block);
            return '<span style="' + style + '">[' + block.type + ']</span>';
        } else {
            return '[' + block.type + ']';
        }
    }

    BlocksTextRenderer.prototype.renderDataBlock = function(block) {
        var value = (block.displayValue != null) ? block.displayValue : block.value;
        if (this.highlight) {
            var style = this.getStyle(block);
            return '<span style="' + style + '">[' + value + ']</span>';
        } else {
            return '[' + value + ']';
        }
    }

    BlocksTextRenderer.prototype.getStyle = function(block) {
        switch(block.semantic) {
            case Semantics.Markup:
                return this.styles.markup;
            case Semantics.Key:
                return this.styles.key;
            case Semantics.Value:
            case Semantics.ArrayItem:
                return this.styles.value;
        }
    }

    BlocksTextRenderer.prototype.getIndent = function(nestingLevel) {
        if (nestingLevel > 0) {
            return Array(nestingLevel + 1).join(this.indentStep);
        } else {
            return '';
        }
    }

//------------------------------------------------------------------------------

    core.serialize = function(rootObject) {
        var serializer = new ObjectSerializer();
        return serializer.serialize(rootObject);
    }

    core.render = function(items) {
        var renderer = new BlocksTextRenderer();
        return renderer.render(items);
    };

    return core;
}(UbjsonTestSuiteCore || {}));