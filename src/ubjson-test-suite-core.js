var UbjsonTestSuiteCore = (function (core) {
//------------------------------------------------------------------------------
    var types = {
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
    core.Types = types;

    var semantics = {
        Markup: 1,
        Key: 2,
        Value: 3,
        Parameter: 4
    };
    core.BlockSemantics = semantics;

//------------------------------------------------------------------------------

    function BlockItem() {
    }

    BlockItem.prototype.toString = function() {
        return 'tag: ' + this.tag + ', type: ' + this.type;
    }

    //core.BlockItem = BlockItem;

    DataItem.prototype = new BlockItem();
    DataItem.prototype.constructor = DataItem;

    function DataItem(semantic, type, value) {
        this.tag = false;
        this.semantic = semantic;
        this.type = type;
        this.value = value;
    }

    //core.DataItem = DataItem;

    TagItem.prototype = new BlockItem();
    TagItem.prototype.constructor = TagItem;

    function TagItem(semantic, type) {
        this.tag = true;
        this.semantic = semantic;
        this.type = type;
    }

    //core.TagItem = TagItem;

//------------------------------------------------------------------------------

    //function serializeArray() {
    //}
    //
    //function serializeObject() {
    //
    //}
    //
    //function serializeEntity(items, entity) {
    //    if (entity instanceof Object) {
    //        if (entity instanceof Array) {
    //            serializeArray(items, entity)
    //        } else {
    //        
    //        }
    //    } else {
    //    
    //    }
    //}  

    core.serialize = function(data) {
        
        //var s = new Serializer()
        //s.load(data);
        //return s.items;
        
        return core.getTest();
        
        var items = [];        
        if (data instanceof Object) {
            if (data instanceof Array) {
                
            } else {
                
            }
        } else {
            throw new Error("Root object must be an Array or Object");
        }        
        return items;
    };

    core.getTest = function() {
        var blocks = [];

        blocks.push(new TagItem(semantics.Markup, types.ObjectBegin));
        blocks.push(new TagItem(semantics.Key, types.Int8));
        blocks.push(new DataItem(semantics.Key, types.Int8, 6));
        blocks.push(new DataItem(semantics.Key, types.String, 'answer'));
        blocks.push(new TagItem(semantics.Value, types.Int8));
        blocks.push(new DataItem(semantics.Value, types.Int8, 42));
        blocks.push(new TagItem(semantics.Markup, types.ObjectEnd));

        return blocks;
    };

    core.render = function(blocks) {
        var text = '';
        var count = blocks.length;
        for (var i = 0; i < count; i++) {
            var block = blocks[i];
            if (block.tag) {
                if (block.type == types.ObjectEnd || block.type == types.ArrayEnd) {
                    text += '\n';
                }
                text += '[' + block.type + ']';
                if (block.type == types.ObjectBegin || block.type == types.ArrayBegin) {
                    text += '\n';
                }
            } else {
                text += '[' + block.value + ']';
            }
        }
        return text;
    };

    return core;
}(UbjsonTestSuiteCore || {}));