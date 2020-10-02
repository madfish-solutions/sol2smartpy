(function() {
  var bad_spec_id_trans_map, config, reserved_map, spec_id_trans_map, warning_once_map;

  config = require("./config");

  reserved_map = {
    self: true,
    block: true,
    msg: true,
    tx: true,
    now: true
  };

  this.translate_var_name = function(name, ctx) {
    if (name.startsWith("@")) {
      return name.substr(1);
    } else if (reserved_map.hasOwnProperty(name)) {
      return "" + config.reserved + "__" + name;
    } else {
      return name;
    }
  };

  spec_id_trans_map = {
    "now.value": "abs(sp.now - (\"1970-01-01T00:00:00Z\": timestamp))",
    "msg.value.sender": "sp.sender",
    "tx.value.origin": "sp.source",
    "block.value.timestamp": "abs(sp.now - (\"1970-01-01T00:00:00Z\": timestamp))",
    "msg.value.value": "sp.mutez(amount)",
    "abi.value.encodePacked": ""
  };

  bad_spec_id_trans_map = {
    "block.value.coinbase": "sp.address(" + (JSON.stringify(config.default_address)) + ")",
    "block.value.difficulty": "sp.nat(0)",
    "block.value.gaslimit": "sp.nat(0)",
    "block.value.number": "sp.nat(0)",
    "msg.value.data": "sp.bytes(\"0x00\")",
    "msg.value.gas": "sp.nat(0)",
    "msg.value.sig": "sp.bytes(\"0x00\")",
    "tx.value.gasprice": "sp.nat(0)"
  };

  warning_once_map = {};

  this.spec_id_translate = function(t, name) {
    var val;
    p("spec_id_translate", t);
    if (spec_id_trans_map.hasOwnProperty(t)) {
      return spec_id_trans_map[t];
    } else if (bad_spec_id_trans_map.hasOwnProperty(t)) {
      val = bad_spec_id_trans_map[t];
      if (!warning_once_map.hasOwnProperty(t)) {
        warning_once_map.hasOwnProperty[t] = true;
        perr("WARNING (translate). We don't have a proper translation for Solidity '" + t + "', so it is translated as '" + val + "'");
      }
      return val;
    } else {
      return name;
    }
  };

}).call(window.require_register("./translate_var_name_smartpy"));
