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

    var MinInt8 = -128;
    var MaxInt8 = 127;
    var MinUInt8 = 0;
    var MaxUInt8 = 255;
    var MinInt16 = -32768;
    var MaxInt16 = 32767;
    var MinInt32 = -2147483648;
    var MaxInt32 = 2147483647;
    var MaxUInt32 = 4294967295;
    var MaxSafeInteger = 9007199254740991;
    var MinSafeInteger = -9007199254740991;

    var Semantics = {
        Unknown: 0,
        Markup: 1,
        Key: 2,
        Value: 3,
        ArrayItem: 4,
        UnknownType: 5,
        LowValuesMask: 0xFF,
        LastArrayItemFlag: 0x100
    };

//------------------------------------------------------------------------------

    function utf8encode(string) {
        return unescape(encodeURIComponent(string));
    }

    function getByteHex(code) {
        if (code < MinUInt8 || code > MaxUInt8)
            throw new Error('Byte range overflow.');
        if (code <= 15) {
            return '0' + code.toString(16).toUpperCase();
        }
        return code.toString(16).toUpperCase();
    }

    function isInteger(number) {
        return number >= MinSafeInteger &&
            number <= MaxSafeInteger &&
            Math.floor(number) === number;
    }

    function findSuitableNumericType(number, optimizeFloats, dataView) {
        if (!isFinite(number))
            return Types.Null;

        if (isInteger(number)) {
            if (number >= MinInt8 && number <= MaxInt8)
                return Types.Int8;

            if (number >= MinUInt8 && number <= MaxUInt8)
                return Types.UInt8;

            if (number >= MinInt16 && number <= MaxInt16)
                return Types.Int16;

            if (number >= MinInt32 && number <= MaxInt32)
                return Types.Int32;

            if (number > MaxInt32 && number <= MaxUInt32)
                return Types.Int64;

            return Types.HighNumber;
        } else {
            if (optimizeFloats) {
                var strNumber = number.toString();
                dataView.setFloat32(0, number);
                var str32 = dataView.getFloat32(0).toString();
                if (str32 === strNumber)
                    return Types.Float32;
                if (strNumber.length < 6)
                    return Types.HighNumber;
            }
            return Types.Float64;
        }
    }

    function escapeBlockText(text) {
        return text.replace(/\\/g, '\\\\').replace(/]/g, '\\]').replace(/\[/g, '\\[');
    }

    function unescapeBlockText(text) {
        return text.replace(/\\]/g, ']').replace(/\\\[/g, '[').replace(/\\\\/g, '\\');
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

    function semanticMarkup(items) {
        var markup = Types.ArrayBegin + Types.ArrayEnd + Types.ObjectBegin + Types.ObjectEnd;
        var known = '';
        for (var k in Types) {
            known += Types[k];
        }
        var nesting = [];
        var count = items.length;
        for (var i = 0; i < count; i++) {
            var block = items[i];
            if (known.indexOf(block.type) == -1) {
                block.semantic = Semantics.UnknownType;
            } else if (markup.indexOf(block.type) >= 0) {
                block.semantic = Semantics.Markup;
                switch(block.type) {
                    case Types.ArrayBegin:
                    case Types.ObjectBegin:
                        nesting.push(block.type);
                        break;
                    case Types.ArrayEnd:
                        if (nesting.pop() != Types.ArrayBegin)
                            return;
                    case Types.ObjectEnd:
                        if (nesting.pop() != Types.ObjectBegin)
                            return;
                }
            } else {
                var scope = nesting[nesting.length - 1] || '';
                if (scope == Types.ArrayBegin) {
                    block.semantic = Semantics.ArrayItem;
                }
            }
        }
    }

//------------------------------------------------------------------------------

    function ObjectSerializer() {
        this.items = [];
        this.currentSemantic = Semantics.Markup;
        var buffer = new ArrayBuffer(4);
        this.floatDataView = new DataView(buffer);
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
        switch (typeof(entity)) {
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
                this.serializeNumber(entity, false);
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
            this.items[this.items.length - 1].semantic |= Semantics.LastArrayItemFlag;
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
        this.serializeNumber(size, true);
        if (size > 0) {
            this.addDataItem(Types.String, utf8value).displayValue = string;
        }
    }

    ObjectSerializer.prototype.serializeNumber = function(number, notNull) {
        var type = findSuitableNumericType(number, true, this.floatDataView);
        if (type == Types.Null && notNull)
            throw new Error('Unallowed Null type');

        this.addTagItem(type);
        if (type != Types.Null) {
            if (type == Types.HighNumber) {
                this.serializeString(number.toString(), false, false);
            } else {
                this.addDataItem(type, number);
            }
        }
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
                unknown: 'color: black',
                markup: 'color: green',
                key: 'color: blue',
                value: 'color: red',
                arrayItem: 'color: orange',
                unknownType: 'color: red; text-decoration: underline'
            };
    }

    BlocksTextRenderer.prototype.BlockIdPrefix = 'block';

    BlocksTextRenderer.prototype.render = function(items) {
        var text = '';
        var indent = '';
        var nestingLevel = 0;
        var prevBlock = null;
        var count = items.length;
        var startNewLine = false;
        for (var i = 0; i < count; i++) {
            var block = items[i];
            var id = this.BlockIdPrefix + i;
            if (block instanceof TagItem) {
                if (block.type == Types.ObjectEnd || block.type == Types.ArrayEnd) {
                    indent = this.getIndent(--nestingLevel);
                    startNewLine = prevBlock != null && prevBlock.type != Types.ObjectBegin && prevBlock.type != Types.ArrayBegin;
                }
                if (prevBlock != null) {
                    if ((prevBlock.semantic & Semantics.LastArrayItemFlag) == Semantics.LastArrayItemFlag) {
                        startNewLine = true;
                    }
                    var prevBlockSemantic = prevBlock.semantic & Semantics.LowValuesMask;
                    var blockSemantic = block.semantic & Semantics.LowValuesMask;
                    if (prevBlockSemantic == Semantics.Value && blockSemantic == Semantics.Key) {
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
                text += this.renderTagBlock(block, id);
                if (block.type == Types.ObjectBegin || block.type == Types.ArrayBegin) {
                    indent = this.getIndent(++nestingLevel);
                    startNewLine = true;
                }
            } else {
                text += this.renderDataBlock(block, id);
            }
            prevBlock = block;
        }
        return text;
    }

    BlocksTextRenderer.prototype.renderTagBlock = function(block, id) {
        var type = this.formalized ? escapeBlockText(block.type) : block.type;
        if (this.highlight) {
            var style = this.getStyle(block);
            return '<span id="' + id + '" style="' + style + '">[' + type + ']</span>';
        } else {
            return '[' + type + ']';
        }
    }

    BlocksTextRenderer.prototype.renderDataBlock = function(block, id) {
        var value = (block.displayValue != null) ? block.displayValue : block.value;
        if (this.formalized) {
            value = block.type + ':' + escapeBlockText(value.toString());
        }
        if (this.highlight) {
            var style = this.getStyle(block);
            return '<span id="' + id + '" style="' + style + '">[' + value + ']</span>';
        } else {
            return '[' + value + ']';
        }
    }

    BlocksTextRenderer.prototype.getStyle = function(block) {
        var semantic = (block.semantic & Semantics.LowValuesMask);
        switch (semantic) {
            case Semantics.Unknown:
                return this.styles.unknown;
            case Semantics.Markup:
                return this.styles.markup;
            case Semantics.Key:
                return this.styles.key;
            case Semantics.Value:
                return this.styles.value;
            case Semantics.ArrayItem:
                return this.styles.arrayItem;
            case Semantics.UnknownType:
                return this.styles.unknownType;
            default:
                throw new Error('Unknown semantic code "' + semantic + '"');
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

    function BinaryWriter() {
        var buffer = new ArrayBuffer(8);
        this.data = new DataView(buffer);
        this.binary = '';
        this.onAfterWrite = null;
    }

    BinaryWriter.prototype.writeBlocks = function(items) {
        var count = items.length;
        var onAfterWrite = this.onAfterWrite;
        for (var i = 0; i < count; i++) {
            var block = items[i];
            if (onAfterWrite) {
                var offset = this.binary.length;
                this.writeBlock(block);
                var size = this.binary.length - offset;
                onAfterWrite(offset, size, i, block);
            } else {
                this.writeBlock(block);
            }
        }
    }

    BinaryWriter.prototype.writeBlock = function(block) {
        if (block instanceof TagItem) {
            this.binary += block.type;
        } else {
            switch (block.type) {
                case Types.String:
                    this.binary += block.value;
                    break;
                case Types.Char:
                case Types.Int8:
                case Types.UInt8:
                    this.binary += String.fromCharCode(block.value & 0xFF);
                    break;
                case Types.Int16:
                    this.data.setInt16(0, block.value, false);
                    this.flush(2);
                    break;
                case Types.Int32:
                    this.data.setInt32(0, block.value, false);
                    this.flush(4);
                    break;
                case Types.Int64:
                    //We use Int64 just for range MaxInt32 < number <= MaxUInt32.
                    //Thus, high four bytes is always zero.
                    this.data.setUint32(0, 0, false);
                    this.data.setUint32(4, block.value, false);
                    this.flush(8);
                    break;
                case Types.Float32:
                    this.data.setFloat32(0, block.value, false);
                    this.flush(4);
                    break;
                case Types.Float64:
                    this.data.setFloat64(0, block.value, false);
                    this.flush(8);
                    break;
                default:
                    throw new Error('Invalid DataItem block type "' + block.type + '"');
            }
        }
    }

    BinaryWriter.prototype.flush = function(size) {
        for (var i = 0; i < size; i++) {
            this.binary += String.fromCharCode(this.data.getUint8(i));
        }
    }

//------------------------------------------------------------------------------

    function HexRenderer() {
        this.bytesPerLine = 16;
    }

    HexRenderer.prototype.HexIdPrefix = 'hex';

    HexRenderer.prototype.renderBinaryString = function(binary, blocksMap) {
        if (blocksMap) {
            return this.renderBinaryStringWithMarkup(binary, blocksMap);
        }
        return this.renderBinaryStringPlain(binary);
    }

    HexRenderer.prototype.renderBinaryStringPlain = function(binary) {
        var text = '';
        if (binary.length <= 0)
            return text;
        var lastPos = binary.length - 1;
        var n = this.bytesPerLine;
        for (var i = 0; i < lastPos; i++) {
            var code = binary.charCodeAt(i);
            if (--n == 0) {
                n = this.bytesPerLine;
                text += getByteHex(code) + '\n';
            } else {
                text += getByteHex(code) + ' ';
            }
        }
        return text + getByteHex(binary.charCodeAt(lastPos));
    }

    HexRenderer.prototype.renderBinaryStringWithMarkup = function(binary, blocksMap) {
        var id, text = '';
        var count = binary.length;
        var n = this.bytesPerLine;
        var nextBlock = blocksMap[0];
        var k = 1;
        var opened = false;
        for (var i = 0; i < count; i++) {
            var hex = getByteHex(binary.charCodeAt(i));
            var start = (nextBlock.start == i);
            if (start) {
                id = this.HexIdPrefix + nextBlock.id;
                if (k < blocksMap.length) {
                    nextBlock = blocksMap[k++];
                }
                if (opened) {
                    text += '</span>';
                    opened = false;
                }
            }
            if (i > 0) {
                if (--n == 0) {
                    n = this.bytesPerLine;
                    text += '\n';
                } else {
                    text += ' ';
                }
            }
            if (start) {
                text += '<span id="' + id + '">' + hex;
                opened = true;
            } else {
                text += hex;
            }
        }
        if (opened) {
            text += '</span>';
        }
        return text;
    }

//------------------------------------------------------------------------------

    function BlocksTextParser() {
    }

    BlocksTextParser.prototype.parse = function(text) {
        var items = [];
        var begin = -1;
        var escape = false;
        var count = text.length;
        for (var i = 0; i < count; i++) {
            var ch = text[i];
            if (ch == '[' && !escape) {
                if (begin >= 0)
                    throw new Error('Unexpected "[" symbol at position ' + i);
                begin = i;
            } else if (ch == ']' && !escape) {
                if (begin == -1)
                    throw new Error('Unexpected "]" symbol at position ' + i);
                var data = text.substring(begin + 1, i);
                var trimmed = unescapeBlockText(data).trim();
                var item;
                if (trimmed.length == 1) {
                    item = new TagItem(Semantics.Unknown, trimmed[0]);
                } else if (trimmed.length > 1 && trimmed[1] == ':') {
                    var value = data.replace(/^\s+/, '').substring(2);
                    item = new DataItem(Semantics.Unknown, trimmed[0], value);
                } else {
                    throw new Error('Unknown block');
                }
                items.push(item);
                begin = -1;
            }
            escape = (ch == '\\' && !escape);
        }
        semanticMarkup(items);
        return items;
    }

//------------------------------------------------------------------------------

    core.ObjectSerializer = ObjectSerializer;
    core.BlocksTextRenderer = BlocksTextRenderer;
    core.BinaryWriter = BinaryWriter;
    core.HexRenderer = HexRenderer;
    core.BlocksTextParser = BlocksTextParser;

    return core;

}(UbjsonTestSuiteCore || {}));