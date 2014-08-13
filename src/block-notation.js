var BlockNotation = (function (notation) {

    var btypes = {};
    btypes.Marker = 1; //markup, type, parameter
    btypes.Size = 2; //length, count (always numeric value)
    btypes.Data = 3; //value
    notation.BlockTypes = btypes;

    var semantics = {};
    semantics.Markup = 1;
    semantics.Key = 2;
    semantics.Value = 3;
    notation.BlockSemantics = semantics;

    notation.create = function(object) {
        var block = {};
        block.type = btypes.Marker;
        block.semantic = semantics.Markup;
        block.value = '{';
        return block;
    };

    return notation;
}(BlockNotation || {}));