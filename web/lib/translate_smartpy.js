
/*
TODO
  remove config.storage use
 */

(function() {
  var Type, config, default_var_map_gen, last_bracket_state, module, number2bytes, some2nat, spec_id_translate, string2bytes, ti_map, translate_type, translate_var_name, type2default_value, type_generalize, walk, _ref;

  module = this;

  

  config = require("./config");

  Type = window.Type;

  _ref = require("./translate_var_name_smartpy"), translate_var_name = _ref.translate_var_name, spec_id_translate = _ref.spec_id_translate;

  default_var_map_gen = require("./type_inference/common").default_var_map_gen;

  type_generalize = require("./type_generalize").type_generalize;

  ti_map = default_var_map_gen();

  ti_map["encodePacked"] = new Type("function2<function<bytes>,function<bytes>>");

  module.warning_counter = 0;

  walk = null;

  this.bin_op_name_map = {
    ADD: "+",
    MUL: "*",
    DIV: "/",
    EQ: "==",
    NE: "!=",
    GT: ">",
    LT: "<",
    GTE: ">=",
    LTE: "<=",
    POW: "SMARTPY_IMPLEMENT_ME_PLEASE_POW",
    BOOL_AND: "&",
    BOOL_OR: "|"
  };

  string2bytes = function(val) {
    var ch, ret, _i, _len;
    ret = ["0x"];
    for (_i = 0, _len = val.length; _i < _len; _i++) {
      ch = val[_i];
      ret.push(ch.charCodeAt(0).rjust(2, "0"));
    }
    if (ret.length === 1) {
      return "sp.bytes(\"0x00\")";
    }
    return ret.join("");
  };

  some2nat = function(val, type) {
    if (type.match(/^int\d{0,3}$/)) {
      val = "abs(" + val + ")";
    }
    if (type.match(/^byte[s]?\d{0,2}$/)) {
      val = "(case (bytes_unpack (" + val + ") : option (nat)) of | Some(a) -> a | None -> 0n end)";
    }
    return val;
  };

  number2bytes = function(val, precision) {
    var hex, i, ret, _i;
    if (precision == null) {
      precision = 32;
    }
    ret = [];
    val = BigInt(val);
    for (i = _i = 0; 0 <= precision ? _i < precision : _i > precision; i = 0 <= precision ? ++_i : --_i) {
      hex = val & BigInt("0xFF");
      ret.push(hex.toString(16).rjust(2, "0"));
      val >>= BigInt(8);
    }
    ret.push("0x");
    ret.reverse();
    return ret.join("");
  };

  this.bin_op_name_cb_map = {
    ASSIGN: function(a, b, ctx, ast) {
      if (config.bytes_type_map.hasOwnProperty(ast.a.type.main) && ast.b.type.main === "string" && ast.b.constructor.name === "Const") {
        b = string2bytes(ast.b.val);
      }
      return "" + a + " = " + b;
    },
    BIT_AND: function(a, b, ctx, ast) {
      var ret;
      a = some2nat(a, ast.a.type.main);
      b = some2nat(b, ast.b.type.main);
      ret = "(" + a + " & " + b + ")";
      if (config.int_type_map.hasOwnProperty(ast.a.type.main) && config.int_type_map.hasOwnProperty(ast.b.type.main)) {
        return "sp.int(" + ret + ")";
      } else {
        return ret;
      }
    },
    BIT_OR: function(a, b, ctx, ast) {
      var ret;
      a = some2nat(a, ast.a.type.main);
      b = some2nat(b, ast.b.type.main);
      ret = "(" + a + " | " + b + ")";
      if (config.int_type_map.hasOwnProperty(ast.a.type.main) && config.int_type_map.hasOwnProperty(ast.b.type.main)) {
        return "sp.int(" + ret + ")";
      } else {
        return ret;
      }
    },
    BIT_XOR: function(a, b, ctx, ast) {
      var ret;
      a = some2nat(a, ast.a.type.main);
      b = some2nat(b, ast.b.type.main);
      ret = "(" + a + " ^ " + b + ")";
      if (config.int_type_map.hasOwnProperty(ast.a.type.main) && config.int_type_map.hasOwnProperty(ast.b.type.main)) {
        return "sp.int(" + ret + ")";
      } else {
        return ret;
      }
    },
    SHR: function(a, b, ctx, ast) {
      var ret;
      a = some2nat(a, ast.a.type.main);
      b = some2nat(b, ast.b.type.main);
      ret = "(" + a + " >> " + b + ")";
      if (config.int_type_map.hasOwnProperty(ast.a.type.main) && config.int_type_map.hasOwnProperty(ast.b.type.main)) {
        return "sp.int(" + ret + ")";
      } else {
        return ret;
      }
    },
    SHL: function(a, b, ctx, ast) {
      var ret;
      a = some2nat(a, ast.a.type.main);
      b = some2nat(b, ast.b.type.main);
      ret = "(" + a + " << " + b + ")";
      if (config.int_type_map.hasOwnProperty(ast.a.type.main) && config.int_type_map.hasOwnProperty(ast.b.type.main)) {
        return "sp.int(" + ret + ")";
      } else {
        return ret;
      }
    },
    INDEX_ACCESS: function(a, b, ctx, ast) {
      var ret, val;
      return ret = ctx.lvalue ? "" + a + "[" + b + "]" : (val = type2default_value(ast.type, ctx), "" + a + ".get(" + b + ", " + val + ")");
    },
    SUB: function(a, b, ctx, ast) {
      if (config.uint_type_map.hasOwnProperty(ast.a.type.main) && config.uint_type_map.hasOwnProperty(ast.b.type.main)) {
        return "abs(" + a + " - " + b + ")";
      } else {
        return "(" + a + " - " + b + ")";
      }
    },
    MOD: function(a, b, ctx, ast) {
      if (config.int_type_map.hasOwnProperty(ast.a.type.main) && config.int_type_map.hasOwnProperty(ast.b.type.main)) {
        return "sp.int(" + a + " % " + b + ")";
      } else {
        return "(" + a + " % " + b + ")";
      }
    }
  };

  this.un_op_name_cb_map = {
    MINUS: function(a) {
      return "-(" + a + ")";
    },
    PLUS: function(a) {
      return "+(" + a + ")";
    },
    BIT_NOT: function(a, ctx, ast) {
      if (!ast.type) {
        perr("WARNING (Translate). BIT_NOT ( ~" + a + " ) translation may be incorrect. Read more https://git.io/JUqiS");
        module.warning_counter++;
      }
      if (ast.type && config.uint_type_map.hasOwnProperty(ast.type.main)) {
        return "abs(not (" + a + "))";
      } else {
        return "not (" + a + ")";
      }
    },
    BOOL_NOT: function(a) {
      return "~(" + a + ")";
    },
    RET_INC: function(a, ctx, ast) {
      var is_uint, one;
      perr("WARNING (Translate). RET_INC may have not fully correct implementation. Read more https://git.io/JUqiS");
      module.warning_counter++;
      is_uint = config.uint_type_map.hasOwnProperty(ast.a.type.main);
      one = "1";
      if (is_uint) {
        one = "sp.nat(1)";
      }
      ctx.sink_list.push("" + a + " = " + a + " + " + one);
      if (is_uint) {
        return ctx.trim_expr = "abs(" + a + " - " + one + ")";
      } else {
        return ctx.trim_expr = "(" + a + " - " + one + ")";
      }
    },
    RET_DEC: function(a, ctx, ast) {
      var is_uint, one;
      perr("WARNING (Translate). RET_DEC may have not fully correct implementation. Read more https://git.io/JUqiS");
      module.warning_counter++;
      is_uint = config.uint_type_map.hasOwnProperty(ast.a.type.main);
      one = "1";
      if (is_uint) {
        one = "sp.nat(1)";
      }
      if (is_uint) {
        ctx.sink_list.push("" + a + " = abs(" + a + " - " + one + ")");
      } else {
        ctx.sink_list.push("" + a + " = " + a + " - " + one);
      }
      return ctx.trim_expr = "(" + a + " + " + one + ")";
    },
    INC_RET: function(a, ctx, ast) {
      var is_uint, one;
      perr("WARNING (Translate). INC_RET may have not fully correct implementation. Read more https://git.io/JUqiS");
      module.warning_counter++;
      is_uint = config.uint_type_map.hasOwnProperty(ast.a.type.main);
      one = "1";
      if (is_uint) {
        one = "sp.nat(1)";
      }
      ctx.sink_list.push("" + a + " = " + a + " + " + one);
      return ctx.trim_expr = "" + a;
    },
    DEC_RET: function(a, ctx, ast) {
      var is_uint, one;
      perr("WARNING (Translate). DEC_RET may have not fully correct implementation. Read more https://git.io/JUqiS");
      module.warning_counter++;
      is_uint = config.uint_type_map.hasOwnProperty(ast.a.type.main);
      one = "1";
      if (is_uint) {
        one = "sp.nat(1)";
      }
      if (is_uint) {
        ctx.sink_list.push("" + a + " = abs(" + a + " - " + one + ")");
      } else {
        ctx.sink_list.push("" + a + " = " + a + " - " + one);
      }
      return ctx.trim_expr = "" + a;
    },
    DELETE: function(a, ctx, ast) {
      var bin_op_a, bin_op_b, nest_ctx;
      if (ast.a.constructor.name !== "Bin_op") {
        throw new Error("can't compile DELETE operation for non 'delete a[b]' like construction. Reason not Bin_op");
      }
      if (ast.a.op !== "INDEX_ACCESS") {
        throw new Error("can't compile DELETE operation for non 'delete a[b]' like construction. Reason not INDEX_ACCESS");
      }
      nest_ctx = ctx.mk_nest();
      bin_op_a = walk(ast.a.a, nest_ctx);
      bin_op_b = walk(ast.a.b, nest_ctx);
      return "remove " + bin_op_b + " from map " + bin_op_a;
    }
  };

  this.translate_type = translate_type = function(type, ctx) {
    var is_struct, key, list, name, nest, translated_type, type_list, v, value, _i, _j, _len, _len1, _ref1, _ref2, _ref3, _ref4;
    switch (type.main) {
      case "bool":
        return "sp.TBool";
      case "Unit":
        return "Unit";
      case "string":
        return "sp.TString";
      case "address":
        return "sp.TAddress";
      case "timestamp":
        return "timestamp";
      case "operation":
        return "operation";
      case "built_in_op_list":
        return "list(operation)";
      case "list":
        nest = translate_type(type.nest_list[0], ctx);
        return "list(" + nest + ")";
      case "array":
        nest = translate_type(type.nest_list[0], ctx);
        return "map(sp.TNat, " + nest + ")";
      case "tuple":
        list = [];
        _ref1 = type.nest_list;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          v = _ref1[_i];
          list.push(translate_type(v, ctx));
        }
        if (list.length === 0) {
          return "unit";
        } else {
          return "(" + (list.join(' * ')) + ")";
        }
        break;
      case "map":
        key = translate_type(type.nest_list[0], ctx);
        value = translate_type(type.nest_list[1], ctx);
        return "sp.TMap(" + key + ", " + value + ")";
      case config.storage:
        return config.storage;
      case "contract":
        if (type.val) {
          return "contract(" + type.val + ")";
        } else {
          type_list = [];
          _ref2 = type.nest_list;
          for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
            type = _ref2[_j];
            translated_type = translate_type(type, ctx);
            type_list.push(translated_type);
          }
          return "contract(" + (type_list.join(", ")) + ")";
        }
        break;
      default:
        if ((_ref3 = ctx.type_decl_map) != null ? _ref3.hasOwnProperty(type.main) : void 0) {
          name = type.main.replace(/\./g, "_");
          is_struct = ((ctx.current_class && ctx.type_decl_map["" + ctx.current_class.name + "_" + name]) || ctx.type_decl_map[name]) && ((_ref4 = ctx.type_decl_map[name]) != null ? _ref4.constructor.name : void 0) === "Class_decl";
          if (ctx.current_class && is_struct) {
            name = "" + ctx.current_class.name + "_" + name;
          }
          name = translate_var_name(name, ctx);
          return name;
        } else if (type.main.match(/^byte[s]?\d{0,2}$/)) {
          return "sp.TBytes";
        } else if (config.uint_type_map.hasOwnProperty(type.main)) {
          return "sp.TNat";
        } else if (config.int_type_map.hasOwnProperty(type.main)) {
          return "sp.TInt";
        } else if (type.main.match(RegExp("^" + config.storage + "_"))) {
          return type.main;
        } else if (type.main.startsWith("@")) {
          return type.main.substr(1);
        } else {
          perr("WARNING (Translate). translate_type unknown solidity type '" + type + "'");
          return "UNKNOWN_TYPE_" + type;
        }
    }
  };

  this.type2default_value = type2default_value = function(type, ctx) {
    var first_item, name, prefix, t, _ref1;
    if (config.uint_type_map.hasOwnProperty(type.main)) {
      return "sp.nat(0)";
    }
    if (config.int_type_map.hasOwnProperty(type.main)) {
      return "0";
    }
    if (config.bytes_type_map.hasOwnProperty(type.main)) {
      return "sp.bytes(\"0x00\")";
    }
    switch (type.main) {
      case "bool":
        return "False";
      case "address":
        return "sp.address(" + (JSON.stringify(config.burn_address)) + ")";
      case "built_in_op_list":
        return "(nil: list(operation))";
      case "contract":
        return "contract(unit)";
      case "map":
      case "array":
        return "sp.map()";
      case "string":
        return '""';
      default:
        if (ctx.type_decl_map.hasOwnProperty(type.main)) {
          t = ctx.type_decl_map[type.main];
          if (t.constructor.name === "Enum_decl") {
            first_item = t.value_list[0].name;
            if (ctx.current_class.name) {
              prefix = "";
              if (ctx.current_class.name) {
                prefix = "" + ctx.current_class.name + "_";
              }
              return "" + name + "_" + first_item;
            } else {
              return "" + name + "(unit)";
            }
          }
          if (t.constructor.name === "Class_decl") {
            name = type.main;
            if ((_ref1 = ctx.current_class) != null ? _ref1.name : void 0) {
              name = "" + ctx.current_class.name + "_" + type.main;
            }
            return translate_var_name("" + name + "_default", ctx);
          }
        }
        perr("WARNING (Translate). Can't translate unknown Solidity type '" + type + "'");
        return "UNKNOWN_TYPE_DEFAULT_VALUE_" + type;
    }
  };

  this.Gen_context = (function() {
    Gen_context.prototype.parent = null;

    Gen_context.prototype.next_gen = null;

    Gen_context.prototype.current_class = null;

    Gen_context.prototype.current_fn = null;

    Gen_context.prototype.is_class_scope = false;

    Gen_context.prototype.lvalue = false;

    Gen_context.prototype.type_decl_map = {};

    Gen_context.prototype.contract_var_map = {};

    Gen_context.prototype.contract = false;

    Gen_context.prototype.trim_expr = "";

    Gen_context.prototype.terminate_expr_check = "";

    Gen_context.prototype.terminate_expr_replace_fn = null;

    Gen_context.prototype.sink_list = [];

    Gen_context.prototype.tmp_idx = 0;

    Gen_context.prototype.type_decl_sink_list = [];

    Gen_context.prototype.enum_list = [];

    Gen_context.prototype.files = null;

    Gen_context.prototype.keep_dir_structure = false;

    Gen_context.prototype.scope_root = null;

    function Gen_context() {
      this.type_decl_map = {};
      this.contract_var_map = {};
      this.sink_list = [];
      this.type_decl_sink_list = [];
      this.enum_list = [];
      this.contract = false;
      this.files = null;
      this.keep_dir_structure = false;
    }

    Gen_context.prototype.mk_nest = function() {
      var t;
      t = new module.Gen_context;
      t.parent = this;
      t.current_class = this.current_class;
      t.current_fn = this.current_fn;
      obj_set(t.contract_var_map, this.contract_var_map);
      obj_set(t.type_decl_map, this.type_decl_map);
      t.type_decl_sink_list = this.type_decl_sink_list;
      t.enum_list = this.enum_list;
      t.contract = this.contract;
      t.files = this.files;
      t.keep_dir_structure = this.keep_dir_structure;
      t.scope_root = this.scope_root;
      return t;
    };

    return Gen_context;

  })();

  last_bracket_state = false;

  walk = function(root, ctx) {
    var a, arg, arg_assign_pair_list, arg_jl, arg_list, arg_num, args, aux, aux_init_type_code, aux_init_type_jl, body, call_expr, case_scope, cb, chk_ret, code, cond, ctx_lvalue, decl, decls, entry, f, field_access_translation, field_decl_jl, fn, fn_code, fn_decl_jl, get_tmp, i, idx, jl, jls, k, loc_code, main_file, modifies_storage, msg, name, old_scope_root, op, orig_ctx, path, prefix, ret, ret_types_list, returns_op_list, returns_value, scope, shift_self, state_name, str, t, target_type, text, tmp_var, translated_type, type, type_decl, type_decl_code, type_decl_jl, type_list, type_o, uses_storage, v, val, _a, _aa, _ab, _ac, _ad, _ae, _b, _case, _i, _j, _k, _l, _len, _len1, _len10, _len11, _len12, _len13, _len14, _len15, _len16, _len17, _len18, _len19, _len2, _len20, _len21, _len3, _len4, _len5, _len6, _len7, _len8, _len9, _m, _n, _o, _p, _q, _r, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref18, _ref19, _ref2, _ref20, _ref21, _ref22, _ref23, _ref24, _ref25, _ref26, _ref27, _ref28, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _s, _t, _u, _v, _var, _w, _x, _y, _z;
    main_file = "";
    last_bracket_state = false;
    switch (root.constructor.name) {
      case "Scope":
        switch (root.original_node_type) {
          case "SourceUnit":
            jls = {};
            jls[main_file] = [];
            _ref1 = root.list;
            for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
              v = _ref1[_i];
              code = walk(v, ctx);
              path = ctx.keep_dir_structure ? v.file : null;
              if (path == null) {
                path = main_file;
              }
              if (code) {
                if (jls[path] == null) {
                  jls[path] = [];
                }
                jls[path].push(code);
              }
            }
            name = config.storage;
            jls[main_file].unshift("import smartpy as sp");
            if (ctx.type_decl_sink_list.length) {
              if (ctx.enum_list.length) {
                jls[main_file].unshift("");
                jls[main_file].unshift("" + (join_list(ctx.enum_list)));
                ctx.enum_list = [];
              }
            }
            for (path in jls) {
              jl = jls[path];
              ctx.files[path] = join_list(jl, "");
            }
            return ctx.files[main_file];
          default:
            if (!root.original_node_type) {
              jls = {};
              jls[main_file] = [];
              _ref2 = root.list;
              for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
                v = _ref2[_j];
                path = ctx.keep_dir_structure ? v.file : null;
                if (path == null) {
                  path = main_file;
                }
                if (jls[path] == null) {
                  jls[path] = [];
                }
                code = walk(v, ctx);
                _ref3 = ctx.sink_list;
                for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
                  loc_code = _ref3[_k];
                  jls[path].push(loc_code);
                }
                ctx.sink_list.clear();
                if (ctx.trim_expr === code) {
                  ctx.trim_expr = "";
                  continue;
                }
                if (ctx.terminate_expr_check === code) {
                  ctx.terminate_expr_check = "";
                  code = ctx.terminate_expr_replace_fn();
                }
                if (code) {
                  jls[path].push(code);
                }
              }
              for (path in jls) {
                jl = jls[path];
                if (jl.length === 0) {
                  code = "pass";
                } else {
                  code = "" + (join_list(jl, ""));
                }
                ctx.files[path] = code;
              }
              return ctx.files[main_file];
            } else {
              puts(root);
              throw new Error("Unknown root.original_node_type " + root.original_node_type);
            }
        }
        break;
      case "Var":
        name = root.name;
        if (name === "this" || name === "super") {
          return "";
        }
        if (ctx.contract_var_map.hasOwnProperty(name)) {
          return "self.data." + name;
        } else {
          if (ctx.current_fn.arg_name_list.has(name)) {
            return name;
          } else {
            return "" + name + ".value";
          }
        }
        break;
      case "Const":
        if (!root.type) {
          puts(root);
          throw new Error("Can't type inference");
        }
        if (config.uint_type_map.hasOwnProperty(root.type.main)) {
          return "sp.nat(" + root.val + ")";
        }
        switch (root.type.main) {
          case "bool":
            switch (root.val) {
              case "true":
                return "True";
              case "false":
                return "False";
              default:
                throw new Error("can't translate bool constant '" + root.val + "'");
            }
            break;
          case "Unit":
            return "unit";
          case "number":
            perr("WARNING (Translate). Number constant passed to the translation stage. That's a type inference mistake");
            module.warning_counter++;
            return root.val;
          case "unsigned_number":
            return "sp.nat(" + root.val + ")";
          case "mutez":
            return "sp.mutez(" + root.val + ")";
          case "string":
            return JSON.stringify(root.val);
          case "built_in_op_list":
            if (root.val) {
              return "" + root.val;
            } else {
              return "(nil: list(operation))";
            }
            break;
          default:
            if (config.bytes_type_map.hasOwnProperty(root.type.main)) {
              return number2bytes(root.val, +root.type.main.replace(/bytes/, ''));
            } else {
              return root.val;
            }
        }
        break;
      case "Bin_op":
        ctx_lvalue = ctx.mk_nest();
        if (0 === root.op.indexOf("ASS")) {
          ctx_lvalue.lvalue = true;
        }
        _a = walk(root.a, ctx_lvalue);
        ctx.sink_list.append(ctx_lvalue.sink_list);
        _b = walk(root.b, ctx);
        return ret = (function() {
          if (op = module.bin_op_name_map[root.op]) {
            last_bracket_state = true;
            if (((root.a.type && root.a.type.main === 'bool') || (root.b.type && root.b.type.main === 'bool')) && (op === '>=' || op === '=/=' || op === '<=' || op === '>' || op === '<' || op === '=')) {
              switch (op) {
                case "=":
                  return "(" + _a + " = " + _b + ")";
                case "=/=":
                  return "(" + _a + " =/= " + _b + ")";
                case ">":
                  return "(" + _a + " and not " + _b + ")";
                case "<":
                  return "((not " + _a + ") and " + _b + ")";
                case ">=":
                  return "(" + _a + " or not " + _b + ")";
                case "<=":
                  return "((not " + _a + ") or " + _b + ")";
                default:
                  return "(" + _a + " " + op + " " + _b + ")";
              }
            } else {
              return "(" + _a + " " + op + " " + _b + ")";
            }
          } else if (cb = module.bin_op_name_cb_map[root.op]) {
            return cb(_a, _b, ctx, root);
          } else {
            throw new Error("Unknown/unimplemented bin_op " + root.op);
          }
        })();
      case "Un_op":
        a = walk(root.a, ctx);
        if (cb = module.un_op_name_cb_map[root.op]) {
          return cb(a, ctx, root);
        } else {
          throw new Error("Unknown/unimplemented un_op " + root.op);
        }
        break;
      case "Field_access":
        t = walk(root.t, ctx);
        if (!root.t.type) {
          perr("WARNING (Translate). Some of types in Field_access aren't resolved. This can cause invalid code generated");
        } else {
          switch (root.t.type.main) {
            case "array":
              switch (root.name) {
                case "length":
                  return "sp.len(" + t + ")";
                default:
                  throw new Error("unknown array field " + root.name);
              }
              break;
            case "bytes":
              switch (root.name) {
                case "length":
                  return "sp.len(" + t + ")";
                default:
                  throw new Error("unknown array field " + root.name);
              }
              break;
            case "enum":
              return root.name;
          }
        }
        if (t === "") {
          return root.name;
        }
        chk_ret = "" + t + "." + root.name;
        ret = "" + t + "." + root.name;
        if (root.t.constructor.name === "Var") {
          if ((_ref4 = ctx.type_decl_map[root.t.name]) != null ? _ref4.is_library : void 0) {
            ret = translate_var_name("" + t + "_" + root.name, ctx);
          }
        }
        return spec_id_translate(chk_ret, ret);
      case "Fn_call":
        arg_list = [];
        _ref5 = root.arg_list;
        for (_l = 0, _len3 = _ref5.length; _l < _len3; _l++) {
          v = _ref5[_l];
          arg_list.push(walk(v, ctx));
        }
        field_access_translation = null;
        if (root.fn.constructor.name === "Field_access") {
          field_access_translation = walk(root.fn.t, ctx);
          if (root.fn.t.type) {
            switch (root.fn.t.type.main) {
              case "array":
                switch (root.fn.name) {
                  case "push":
                    tmp_var = "tmp_" + (ctx.tmp_idx++);
                    ctx.sink_list.push("const " + tmp_var + " : " + (translate_type(root.fn.t.type, ctx)) + " = " + field_access_translation + ";");
                    return "" + tmp_var + "[size(" + tmp_var + ")] = " + arg_list[0];
                  default:
                    throw new Error("unknown array field function " + root.fn.name);
                }
            }
          }
        }
        if (root.fn.constructor.name === "Var") {
          switch (root.fn.name) {
            case "require":
            case "assert":
            case "require2":
              cond = arg_list[0];
              str = arg_list[1];
              if (str) {
                return "sp.verify(" + cond + ", " + str + ")";
              } else {
                return "sp.verify(" + cond + ")";
              }
              break;
            case "revert":
              str = arg_list[0] || '"revert"';
              return "sp.failwith(" + str + ")";
            case "sha512":
              msg = arg_list[0];
              return "sp.sha512(" + msg + ")";
            case "sha256":
              msg = arg_list[0];
              return "sp.sha256(" + msg + ")";
            case "sha3":
            case "keccak256":
              perr("WARNING (Translate). " + root.fn.name + " hash function will be translated as sha_256. Read more: https://github.com/madfish-solutions/sol2ligo/wiki/Known-issues#hash-functions");
              msg = arg_list[0];
              return "sp.sha256(" + msg + ")";
            case "selfdestruct":
              perr("WARNING (Translate). " + root.fn.name + " does not exist in LIGO. Statement translated as is");
              msg = arg_list[0];
              return "selfdestruct(" + msg + ") (* unsupported *)";
            case "blockhash":
              msg = arg_list[0];
              perr("WARNING (Translate). " + root.fn.name + " does not exist in LIGO. We replaced it with sp.bytes(\"" + msg + "\").");
              return "sp.bytes(\"0x00\") # Should be blockhash of " + msg;
            case "ripemd160":
              perr("WARNING (Translate). " + root.fn.name + " hash function will be translated as blake2b. Read more: https://github.com/madfish-solutions/sol2ligo/wiki/Known-issues#hash-functions");
              msg = arg_list[0];
              return "sp.blake2b(" + msg + ")";
            case "ecrecover":
              perr("WARNING (Translate). ecrecover function does not exist in LIGO. Read more: https://github.com/madfish-solutions/sol2ligo/wiki/Known-issues#ecrecover");
              fn = "ecrecover";
              break;
            default:
              fn = root.fn.name;
          }
        } else {
          fn = walk(root.fn, ctx);
        }
        call_expr = "" + fn + "(" + (arg_list.join(', ')) + ")";
        if (!root.left_unpack || (fn === "get_contract" || fn === "transaction")) {
          return call_expr;
        } else {
          if (root.fn_decl) {
            _ref6 = root.fn_decl, returns_op_list = _ref6.returns_op_list, uses_storage = _ref6.uses_storage, modifies_storage = _ref6.modifies_storage, returns_value = _ref6.returns_value;
            type_o = root.fn_decl.type_o;
            if (root.is_fn_decl_from_using) {
              if (uses_storage) {
                shift_self = arg_list.shift();
              }
              arg_list.unshift(field_access_translation);
              if (uses_storage) {
                arg_list.unshift(shift_self);
              }
              call_expr = "" + root.fn_name_using + "(" + (arg_list.join(', ')) + ")";
            }
          } else if (type_decl = ti_map[root.fn.name]) {
            returns_op_list = false;
            modifies_storage = false;
            returns_value = type_decl.nest_list[1].nest_list.length > 0;
            type_o = type_decl.nest_list[1];
          } else if (ctx.contract_var_map.hasOwnProperty(root.fn.name)) {
            decl = ctx.contract_var_map[root.fn.name];
            if (decl.constructor.name === "Fn_decl_multiret") {
              return call_expr;
            }
            return "" + config.contract_storage + "." + root.fn.name;
          } else {
            perr("WARNING (Translate). !root.fn_decl " + root.fn.name);
            return call_expr;
          }
          ret_types_list = [];
          _ref7 = type_o.nest_list;
          for (_m = 0, _len4 = _ref7.length; _m < _len4; _m++) {
            v = _ref7[_m];
            ret_types_list.push(translate_type(v, ctx));
          }
          if (ret_types_list.length === 0) {
            return call_expr;
          } else if (ret_types_list.length === 1 && returns_value) {
            ctx.terminate_expr_replace_fn = function() {
              perr("WARNING (Translate). " + call_expr + " was terminated with dummy variable declaration");
              tmp_var = "terminate_tmp_" + (ctx.tmp_idx++);
              return "const " + tmp_var + " : (" + (ret_types_list.join(' * ')) + ") = " + call_expr;
            };
            return ctx.terminate_expr_check = call_expr;
          } else {
            if (ret_types_list.length === 1) {
              if (returns_op_list) {
                return "" + config.op_list + " = " + call_expr;
              } else if (modifies_storage) {
                return "" + config.contract_storage + " = " + call_expr;
              } else {
                throw new Error("WTF !returns_op_list !modifies_storage");
              }
            } else {
              tmp_var = "tmp_" + (ctx.tmp_idx++);
              ctx.sink_list.push("const " + tmp_var + " : (" + (ret_types_list.join(' * ')) + ") = " + call_expr);
              arg_num = 0;
              get_tmp = function() {
                if (ret_types_list.length === 1) {
                  return tmp_var;
                } else {
                  return "" + tmp_var + "." + (arg_num++);
                }
              };
              if (returns_op_list) {
                ctx.sink_list.push("" + config.op_list + " = " + (get_tmp()));
              }
              if (modifies_storage) {
                ctx.sink_list.push("" + config.contract_storage + " = " + (get_tmp()));
              }
              return ctx.trim_expr = get_tmp();
            }
          }
        }
        break;
      case "Struct_init":
        arg_list = [];
        for (i = _n = 0, _ref8 = root.val_list.length - 1; 0 <= _ref8 ? _n <= _ref8 : _n >= _ref8; i = 0 <= _ref8 ? ++_n : --_n) {
          arg_list.push("" + root.arg_names[i] + " = " + (walk(root.val_list[i], ctx)));
        }
        return "sp.record(" + (arg_list.join(', ')) + ")";
      case "Type_cast":
        target_type = translate_type(root.target_type, ctx);
        t = walk(root.t, ctx);
        if (t === "" && target_type === "sp.TAddress") {
          return "self_address";
        }
        if (target_type === "sp.TInt") {
          return "sp.int(abs(" + t + "))";
        } else if (target_type === "sp.TNat") {
          return "abs(" + t + ")";
        } else if (target_type === "sp.TAddress" && t === "0") {
          return type2default_value(root.target_type, ctx);
        } else if (target_type === "sp.TBytes" && ((_ref9 = root.t.type) != null ? _ref9.main : void 0) === "string") {
          return "sp.pack(" + t + ")";
        } else if (target_type === "sp.TAddress" && (t === "0x0" || t === "0")) {
          return "sp.address(" + (JSON.stringify(config.burn_address)) + ")";
        } else {
          if (/^sp\.T/.test(target_type)) {
            target_type = target_type.replace(/^sp\.T/, "sp.");
            target_type = target_type.toLowerCase();
          }
          return "" + target_type + "(" + t + ")";
        }
        break;
      case "Comment":
        if (ctx.keep_dir_structure && root.text.startsWith("#include")) {
          text = root.text.replace(".sol", ".ligo");
          return text;
        } else if (root.can_skip) {
          return "";
        } else {
          return "pass # " + (root.text.replace(/[\n\r]/g, ''));
        }
        break;
      case "Continue":
        return "(* `continue` statement is not supported in LIGO *)";
      case "Break":
        return "(* `break` statement is not supported in LIGO *)";
      case "Var_decl":
        name = root.name;
        type = translate_type(root.type, ctx);
        if (ctx.is_class_scope && !root.is_const) {
          ctx.contract_var_map[name] = root;
          return "";
        } else {
          if (root.assign_value) {
            val = walk(root.assign_value, ctx);
            if (config.bytes_type_map.hasOwnProperty(root.type.main) && root.assign_value.type.main === "string" && root.assign_value.constructor.name === "Const") {
              val = string2bytes(root.assign_value.val);
            }
            if (config.bytes_type_map.hasOwnProperty(root.type.main) && root.assign_value.type.main === "number" && root.assign_value.constructor.name === "Const") {
              val = number2bytes(root.assign_value.val);
            }
          } else {
            val = type2default_value(root.type, ctx);
          }
          if (ctx.current_fn) {
            return "" + name + " = sp.local(" + (JSON.stringify(name)) + ", " + val + ")";
          } else {
            return "" + name + " = " + val;
          }
        }
        break;
      case "Var_decl_multi":
        if (root.assign_value) {
          val = walk(root.assign_value, ctx);
          tmp_var = "tmp_" + (ctx.tmp_idx++);
          jl = [];
          type_list = [];
          _ref10 = root.list;
          for (idx = _o = 0, _len5 = _ref10.length; _o < _len5; idx = ++_o) {
            _var = _ref10[idx];
            name = _var.name;
            type_list.push(type = translate_type(_var.type, ctx));
            jl.push("const " + name + " : " + type + " = " + tmp_var + "." + idx + ";");
          }
          return "const " + tmp_var + " : (" + (type_list.join(' * ')) + ") = " + val + ";\n" + (join_list(jl));
        } else {
          perr("WARNING (Translate). Var_decl_multi with no assign value should be unreachable, but something went wrong");
          module.warning_counter++;
          jl = [];
          _ref11 = root.list;
          for (_p = 0, _len6 = _ref11.length; _p < _len6; _p++) {
            _var = _ref11[_p];
            name = _var.name;
            type = translate_type(root.type, ctx);
            jl.push("const " + name + " : " + type + " = " + (type2default_value(_var.type, ctx)));
          }
          return jl.join("\n");
        }
        break;
      case "Throw":
        if (root.t) {
          t = walk(root.t, ctx);
          return "sp.failwith(" + t + ")";
        } else {
          return 'sp.failwith("throw")';
        }
        break;
      case "Ret_multi":
        jl = [];
        _ref12 = root.t_list;
        for (idx = _q = 0, _len7 = _ref12.length; _q < _len7; idx = ++_q) {
          v = _ref12[idx];
          jl.push(walk(v, ctx));
        }
        if (ctx.scope_root.constructor.name === "Fn_decl_multiret") {
          if (ctx.scope_root.name !== "main") {
            _ref13 = ctx.scope_root.type_o.nest_list;
            for (idx = _r = 0, _len8 = _ref13.length; _r < _len8; idx = ++_r) {
              type = _ref13[idx];
              if (!root.t_list[idx]) {
                jl.push(type2default_value(type, ctx));
              }
            }
          }
          if ((_ref14 = ctx.current_fn.visibility) !== "private" && _ref14 !== "internal") {
            perr("WARNING (Translate). entry points cannot have return statements.");
            return "pass # return " + (jl.join(', ')) + " # entry points cannot have return statements.";
          } else {
            return "sp.result(" + (jl.join(', ')) + ")";
          }
        } else {
          perr("WARNING (Translate). Return at non end-of-function position is prohibited");
          return "sp.failwith(\"return at non end-of-function position is prohibited\")";
        }
        break;
      case "If":
        cond = walk(root.cond, ctx);
        if (!last_bracket_state) {
          cond = "(" + cond + ")";
        }
        old_scope_root = ctx.scope_root;
        ctx.scope_root = root;
        t = walk(root.t, ctx);
        f = walk(root.f, ctx);
        ctx.scope_root = old_scope_root;
        if (!t) {
          t = "pass";
        }
        ret = "sp.if " + cond + ":\n  " + (make_tab(t, '  '));
        if (f) {
          ret = "" + ret + "\nsp.else:\n  " + (make_tab(f, '  '));
        }
        return ret;
      case "While":
        cond = walk(root.cond, ctx);
        if (!last_bracket_state) {
          cond = "(" + cond + ")";
        }
        old_scope_root = ctx.scope_root;
        ctx.scope_root = root;
        scope = walk(root.scope, ctx);
        ctx.scope_root = old_scope_root;
        return "sp.while " + cond + ":\n  " + (make_tab(scope, '  ')) + ";";
      case "PM_switch":
        cond = walk(root.cond, ctx);
        ctx = ctx.mk_nest();
        jl = [];
        _ref15 = root.scope.list;
        for (_s = 0, _len9 = _ref15.length; _s < _len9; _s++) {
          _case = _ref15[_s];
          case_scope = walk(_case.scope, ctx);
          if (/;$/.test(case_scope)) {
            case_scope = case_scope.slice(0, -1);
          }
          jl.push("| " + _case.struct_name + "(" + _case.var_decl.name + ") -> " + case_scope);
        }
        if (jl.length) {
          return "case " + cond + " of\n" + (join_list(jl, '')) + "\nend";
        } else {
          return "unit";
        }
        break;
      case "Fn_decl_multiret":
        orig_ctx = ctx;
        ctx = ctx.mk_nest();
        ctx.current_fn = root;
        arg_jl = ["self"];
        _ref16 = root.arg_name_list;
        for (_t = 0, _len10 = _ref16.length; _t < _len10; _t++) {
          v = _ref16[_t];
          arg_jl.push(translate_var_name(v, ctx));
        }
        ctx.scope_root = root;
        body = walk(root.scope, ctx);
        if (root.arg_name_list.length) {
          aux_init_type_jl = [];
          _ref17 = root.arg_name_list;
          for (idx = _u = 0, _len11 = _ref17.length; _u < _len11; idx = ++_u) {
            v = _ref17[idx];
            type = translate_type(root.type_i.nest_list[idx], ctx);
            name = translate_var_name(v, ctx);
            aux_init_type_jl.push("sp.set_type(" + name + ", " + type + ")");
          }
          body = "" + (aux_init_type_jl.join('\n')) + "\n" + body;
        }
        ret = "def " + root.name + "(" + (arg_jl.join(', ')) + "):\n  " + (make_tab(body, '  '));
        if ((_ref18 = root.visibility) === "private" || _ref18 === "internal") {
          ret = "@sp.private_entry_point\n" + ret;
        } else {
          ret = "@sp.entry_point\n" + ret;
        }
        return ret;
      case "Class_decl":
        if (root.need_skip) {
          return "";
        }
        if (root.is_interface) {
          return "";
        }
        if (root.is_contract && !root.is_last) {
          return "";
        }
        orig_ctx = ctx;
        prefix = "";
        if (ctx.parent && ctx.current_class && root.namespace_name) {
          ctx.parent.type_decl_map["" + ctx.current_class.name + "." + root.name] = root;
          prefix = ctx.current_class.name;
        }
        ctx.type_decl_map[root.name] = root;
        ctx = ctx.mk_nest();
        ctx.current_class = root;
        ctx.is_class_scope = true;
        _ref19 = root.scope.list;
        for (_v = 0, _len12 = _ref19.length; _v < _len12; _v++) {
          v = _ref19[_v];
          switch (v.constructor.name) {
            case "Enum_decl":
            case "Class_decl":
              ctx.type_decl_map[v.name] = v;
              break;
            case "PM_switch":
              _ref20 = root.scope.list;
              for (_w = 0, _len13 = _ref20.length; _w < _len13; _w++) {
                _case = _ref20[_w];
                ctx.type_decl_map[_case.var_decl.type.main] = _case.var_decl;
              }
              break;
            default:
              "skip";
          }
        }
        field_decl_jl = [];
        fn_decl_jl = [];
        _ref21 = root.scope.list;
        for (_x = 0, _len14 = _ref21.length; _x < _len14; _x++) {
          v = _ref21[_x];
          switch (v.constructor.name) {
            case "Var_decl":
              if (!v.is_const) {
                field_decl_jl.push(walk(v, ctx));
              } else {
                ctx.sink_list.push(walk(v, ctx));
              }
              break;
            case "Fn_decl_multiret":
              "skip";
              break;
            case "Enum_decl":
              "skip";
              break;
            case "Class_decl":
              code = walk(v, ctx);
              if (code) {
                ctx.sink_list.push(code);
              }
              break;
            case "Comment":
              ctx.sink_list.push(walk(v, ctx));
              break;
            case "Event_decl":
              ctx.sink_list.push(walk(v, ctx));
              break;
            default:
              throw new Error("unknown v.constructor.name " + v.constructor.name);
          }
        }
        jl = [];
        jl.append(ctx.sink_list);
        ctx.sink_list.clear();
        _ref22 = root.scope.list;
        for (_y = 0, _len15 = _ref22.length; _y < _len15; _y++) {
          v = _ref22[_y];
          switch (v.constructor.name) {
            case "Var_decl":
              "skip";
              break;
            case "Enum_decl":
              jl.unshift(walk(v, ctx));
              break;
            case "Fn_decl_multiret":
              fn_decl_jl.push(walk(v, ctx));
              break;
            case "Class_decl":
            case "Comment":
            case "Event_decl":
              "skip";
              break;
            default:
              throw new Error("unknown v.constructor.name " + v.constructor.name);
          }
        }
        if (root.is_contract || root.is_library) {
          state_name = config.storage;
          arg_list = ["self"];
          arg_assign_pair_list = [];
          type_decl_jl = [];
          _ref23 = ctx.contract_var_map;
          for (k in _ref23) {
            v = _ref23[k];
            arg_list.push(k);
            arg_assign_pair_list.push("" + k + "=" + k);
            type_decl_jl.push("" + k + "=" + (translate_type(v.type, ctx)));
          }
          name = root.name;
          name = translate_var_name(name, ctx);
          aux_init_type_code = "";
          if (type_decl_jl.length) {
            type_decl_code = type_decl_jl.join(",\n");
            aux_init_type_code = "self.init_type(\n  sp.TRecord(\n    " + (make_tab(type_decl_code, '    ')) + "\n  )\n)";
          }
          fn_code = fn_decl_jl.join("\n\n");
          jl.unshift("class " + name + "(sp.Contract):\n  def __init__(" + (arg_list.join(', ')) + "):\n    " + (make_tab(aux_init_type_code, '    ')) + "\n    self.init(" + (arg_assign_pair_list.join(', ')) + ")\n  \n  " + (make_tab(fn_code, '  ')) + "\n");
        } else {
          name = root.name;
          if (prefix) {
            name = "" + prefix + "_" + name;
          }
          name = translate_var_name(name, ctx);
          ctx.type_decl_sink_list.push({
            name: name,
            field_decl_jl: field_decl_jl
          });
        }
        return jl.join("\n\n");
      case "Enum_decl":
        jl = [];
        _ref24 = root.value_list;
        for (idx = _z = 0, _len16 = _ref24.length; _z < _len16; idx = ++_z) {
          v = _ref24[idx];
          ctx.contract_var_map[v.name] = v;
          aux = "";
          if (v.type) {
            aux = " of " + (translate_var_name(v.type.main.replace(/\./g, "_", ctx)));
          }
          jl.push("| " + v.name + aux);
        }
        if (jl.length) {
          entry = join_list(jl, ' ');
        } else {
          entry = "unit";
        }
        return "type " + root.name + " is\n  " + entry + ";";
      case "Ternary":
        cond = walk(root.cond, ctx);
        t = walk(root.t, ctx);
        f = walk(root.f, ctx);
        return "" + t + " if " + cond + " else " + f;
      case "New":
        arg_list = [];
        _ref25 = root.arg_list;
        for (_aa = 0, _len17 = _ref25.length; _aa < _len17; _aa++) {
          v = _ref25[_aa];
          arg_list.push(walk(v, ctx));
        }
        args = "" + (join_list(arg_list, ', '));
        translated_type = translate_type(root.cls, ctx);
        if (root.cls.main === "array") {
          return "sp.map()";
        } else if (translated_type === "sp.TBytes") {
          return "sp.bytes(\"0x00\")";
        } else {
          return "" + translated_type + "(" + args + ")";
        }
        break;
      case "Tuple":
        arg_list = [];
        _ref26 = root.list;
        for (_ab = 0, _len18 = _ref26.length; _ab < _len18; _ab++) {
          v = _ref26[_ab];
          arg_list.push(walk(v, ctx));
        }
        return "(" + (arg_list.join(', ')) + ")";
      case "Array_init":
        arg_list = [];
        _ref27 = root.list;
        for (_ac = 0, _len19 = _ref27.length; _ac < _len19; _ac++) {
          v = _ref27[_ac];
          arg_list.push(walk(v, ctx));
        }
        if (root.type.main === "built_in_op_list") {
          return "list [" + (arg_list.join("; ")) + "]";
        } else {
          decls = [];
          for (i = _ad = 0, _len20 = arg_list.length; _ad < _len20; i = ++_ad) {
            arg = arg_list[i];
            decls.push("" + i + "n -> " + arg + ";");
          }
          return "map\n  " + (join_list(decls, '  ')) + "\nend";
        }
        break;
      case "Event_decl":
        args = [];
        _ref28 = root.arg_list;
        for (_ae = 0, _len21 = _ref28.length; _ae < _len21; _ae++) {
          arg = _ref28[_ae];
          name = arg._name;
          type = translate_type(arg, ctx);
          args.push("" + name + " : " + type);
        }
        return "(* EventDefinition " + root.name + "(" + (args.join('; ')) + ") *)";
      case "Include":
        return "#include \"" + root.path + "\"";
      default:
        if (ctx.next_gen != null) {
          return ctx.next_gen(root, ctx);
        } else {
          perr(root);
          throw new Error("Unknown root.constructor.name " + root.constructor.name);
        }
    }
  };

  this.gen = function(root, opt) {
    var ctx, ret;
    if (opt == null) {
      opt = {};
    }
    ctx = new module.Gen_context;
    ctx.next_gen = opt.next_gen;
    ctx.keep_dir_structure = opt.keep_dir_structure;
    ctx.files = {};
    ret = walk(root, ctx);
    if (opt.keep_dir_structure) {
      return ctx.files[""];
    } else {
      return ret;
    }
  };

}).call(window.require_register("./translate_smartpy"));
