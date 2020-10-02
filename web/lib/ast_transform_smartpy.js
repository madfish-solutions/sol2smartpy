(function() {
  var ass_op_unpack, fix_modifier_order, mark_last, math_funcs_convert, modifier_unpack, module, translate_var_name;

  module = this;

  fix_modifier_order = require("./transforms/fix_modifier_order").fix_modifier_order;

  math_funcs_convert = require("./transforms/math_funcs_convert").math_funcs_convert;

  ass_op_unpack = require("./transforms/ass_op_unpack").ass_op_unpack;

  modifier_unpack = require("./transforms/modifier_unpack").modifier_unpack;

  mark_last = require("./transforms/mark_last").mark_last;

  translate_var_name = require("./translate_var_name_smartpy").translate_var_name;

  this.pre_ti = function(root, opt) {
    if (opt == null) {
      opt = {};
    }
    root = fix_modifier_order(root);
    root = math_funcs_convert(root);
    root = ass_op_unpack(root);
    root = modifier_unpack(root);
    return root;
  };

  this.post_ti = function(root, opt) {
    if (opt == null) {
      opt = {};
    }
    root = mark_last(root, opt);
    return root;
  };

}).call(window.require_register("./ast_transform_smartpy"));
