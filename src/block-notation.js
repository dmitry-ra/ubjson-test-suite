var BlockNotation = (function (notation) {

    var types = {};
    types.Null = 'Z';
    types.Noop = 'N';
    types.True = 'T';
    types.False = 'F';
    types.Int8 = 'i';
    types.UInt8 = 'U';
    types.Int16 = 'I';
    types.Int32 = 'l';
    types.Int64 = 'L';
    types.Float32 = 'd';
    types.Float64 = 'D';
    types.HighNumber = 'H';
    types.Char = 'C';
    types.String = 'S';
    types.ArrayBegin = '[';
    types.ArrayEnd = ']';
    types.ObjectBegin = '{';
    types.ObjectEnd = '}';
    types.Type = '$';
    types.Count = '#';
    notation.Types = types;

    var semantics = {};
    semantics.Markup = 1;
    semantics.Key = 2;
    semantics.Value = 3;
    semantics.Parameter = 4;
    notation.BlockSemantics = semantics;
    
    function createBlock(tag, semantic, type, value) {
        return {
            tag: tag,
            semantic: semantic,
            type: type,
            value: value
        };        
    }
    
    notation.serialize = function(data) {
        var blocks = [];

        //is object
        //is array
        //is integer
        //is float
        //is string

        return blocks;
    };

    notation.getTest = function() {
        var blocks = [];

        //[{][i][6][answer][i][42][}]

        blocks.push(createBlock(true, semantics.Markup, types.ObjectBegin));
        blocks.push(createBlock(true, semantics.Key, types.Int8));
        blocks.push(createBlock(false, semantics.Key, types.Int8, 6));
        blocks.push(createBlock(false, semantics.Key, types.String, 'answer'));
        blocks.push(createBlock(true, semantics.Value, types.Int8));
        blocks.push(createBlock(false, semantics.Value, types.Int8, 42));
        blocks.push(createBlock(true, semantics.Markup, types.ObjectEnd));

        return blocks;
    };

    notation.render = function(blocks) {
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

    return notation;
}(BlockNotation || {}));