###
TODO
  remove config.storage use
###

module = @
require "fy/codegen"
config = require "./config"
Type = require "type"
{translate_var_name, spec_id_translate} = require "./translate_var_name_smartpy"
{default_var_map_gen} = require "./type_inference/common"
{type_generalize} = require "./type_generalize"
ti_map = default_var_map_gen()
ti_map["encodePacked"] = new Type "function2<function<bytes>,function<bytes>>"

# in this module AST structure gets translated into actual textual code representation

module.warning_counter = 0
# ###################################################################################################
#    *_op
# ###################################################################################################
walk = null

@bin_op_name_map =
  ADD : "+"
  # SUB : "-"
  MUL : "*"
  DIV : "/"
  # MOD : "%"
  
  EQ  : "=="
  NE  : "!="
  GT  : ">"
  LT  : "<"
  GTE : ">="
  LTE : "<="
  POW : "SMARTPY_IMPLEMENT_ME_PLEASE_POW"
  
  BOOL_AND: "&"
  BOOL_OR : "|"

string2bytes = (val)->
  ret = ["0x"]
  for ch in val
    ret.push ch.charCodeAt(0).rjust 2, "0"
  
  if ret.length == 1
    return "sp.bytes(\"0x00\")"
  ret.join ""

some2nat = (val, type)->
  if type.match /^int\d{0,3}$/
    val = "abs(#{val})"
  if type.match /^byte[s]?\d{0,2}$/
    val = "(case (bytes_unpack (#{val}) : option (nat)) of | Some(a) -> a | None -> 0n end)"
  val

number2bytes = (val, precision = 32)->
  ret = []
  val = BigInt(val)
  for i in [0 ... precision]
    hex = val & BigInt("0xFF")
    ret.push hex.toString(16).rjust 2, "0"
    val >>= BigInt(8)
  ret.push "0x"
  ret.reverse()
  ret.join ""

@bin_op_name_cb_map =
  ASSIGN  : (a, b, ctx, ast)->
    if config.bytes_type_map.hasOwnProperty(ast.a.type.main) and ast.b.type.main == "string" and ast.b.constructor.name == "Const"
      b = string2bytes ast.b.val
    "#{a} = #{b}"
  BIT_AND : (a, b, ctx, ast) ->
    a = some2nat(a, ast.a.type.main)
    b = some2nat(b, ast.b.type.main)
    ret = "(#{a} & #{b})"
    if config.int_type_map.hasOwnProperty(ast.a.type.main) and config.int_type_map.hasOwnProperty(ast.b.type.main)
      "sp.int(#{ret})"
    else
      ret
  BIT_OR  : (a, b, ctx, ast) -> 
    a = some2nat(a, ast.a.type.main)
    b = some2nat(b, ast.b.type.main)
    ret = "(#{a} | #{b})"
    if config.int_type_map.hasOwnProperty(ast.a.type.main) and config.int_type_map.hasOwnProperty(ast.b.type.main)
      "sp.int(#{ret})"
    else
      ret
  BIT_XOR : (a, b, ctx, ast) -> 
    a = some2nat(a, ast.a.type.main)
    b = some2nat(b, ast.b.type.main)
    ret = "(#{a} ^ #{b})"
    if config.int_type_map.hasOwnProperty(ast.a.type.main) and config.int_type_map.hasOwnProperty(ast.b.type.main)
      "sp.int(#{ret})"
    else
      ret
  SHR     : (a, b, ctx, ast) ->
    a = some2nat(a, ast.a.type.main)
    b = some2nat(b, ast.b.type.main)
    ret = "(#{a} >> #{b})"
    if config.int_type_map.hasOwnProperty(ast.a.type.main) and config.int_type_map.hasOwnProperty(ast.b.type.main)
      "sp.int(#{ret})"
    else
      ret
  SHL     : (a, b, ctx, ast) -> 
    a = some2nat(a, ast.a.type.main)
    b = some2nat(b, ast.b.type.main)
    ret = "(#{a} << #{b})"
    if config.int_type_map.hasOwnProperty(ast.a.type.main) and config.int_type_map.hasOwnProperty(ast.b.type.main)
      "sp.int(#{ret})"
    else
      ret
  
  # disabled until requested
  INDEX_ACCESS : (a, b, ctx, ast)->
    ret = if ctx.lvalue
      "#{a}[#{b}]"
    else
      val = type2default_value ast.type, ctx
      "#{a}.get(#{b}, #{val})"
      # "get_force(#{b}, #{a})"
  # nat - nat edge case
  SUB : (a, b, ctx, ast)->
    if config.uint_type_map.hasOwnProperty(ast.a.type.main) and config.uint_type_map.hasOwnProperty(ast.b.type.main)
      "abs(#{a} - #{b})"
    else
      "(#{a} - #{b})"
  MOD : (a, b, ctx, ast)->
    if config.int_type_map.hasOwnProperty(ast.a.type.main) and config.int_type_map.hasOwnProperty(ast.b.type.main)
      "sp.int(#{a} % #{b})"
    else
      "(#{a} % #{b})"

@un_op_name_cb_map =
  MINUS   : (a)->"-(#{a})"
  PLUS    : (a)->"+(#{a})"
  BIT_NOT : (a, ctx, ast)->
    if !ast.type
      perr "WARNING (Translate). BIT_NOT ( ~#{a} ) translation may be incorrect. Read more https://git.io/JUqiS"
      module.warning_counter++
    if ast.type and config.uint_type_map.hasOwnProperty ast.type.main
      "abs(not (#{a}))"
    else
      "not (#{a})"
  BOOL_NOT: (a)->"~(#{a})"
  RET_INC : (a, ctx, ast)->
    perr "WARNING (Translate). RET_INC may have not fully correct implementation. Read more https://git.io/JUqiS"
    module.warning_counter++
    is_uint = config.uint_type_map.hasOwnProperty(ast.a.type.main)
    one = "1"
    one = "sp.nat(1)" if is_uint
    ctx.sink_list.push "#{a} = #{a} + #{one}"
    if is_uint
      ctx.trim_expr = "abs(#{a} - #{one})"
    else
      ctx.trim_expr = "(#{a} - #{one})"
  
  RET_DEC : (a, ctx, ast)->
    perr "WARNING (Translate). RET_DEC may have not fully correct implementation. Read more https://git.io/JUqiS"
    module.warning_counter++
    is_uint = config.uint_type_map.hasOwnProperty(ast.a.type.main)
    one = "1"
    one = "sp.nat(1)" if is_uint
    if is_uint
      ctx.sink_list.push "#{a} = abs(#{a} - #{one})"
    else
      ctx.sink_list.push "#{a} = #{a} - #{one}"
    ctx.trim_expr = "(#{a} + #{one})"
  
  INC_RET : (a, ctx, ast)->
    perr "WARNING (Translate). INC_RET may have not fully correct implementation. Read more https://git.io/JUqiS"
    module.warning_counter++
    is_uint = config.uint_type_map.hasOwnProperty(ast.a.type.main)
    one = "1"
    one = "sp.nat(1)" if is_uint
    ctx.sink_list.push "#{a} = #{a} + #{one}"
    ctx.trim_expr = "#{a}"
  
  DEC_RET : (a, ctx, ast)->
    perr "WARNING (Translate). DEC_RET may have not fully correct implementation. Read more https://git.io/JUqiS"
    module.warning_counter++
    is_uint = config.uint_type_map.hasOwnProperty(ast.a.type.main)
    one = "1"
    one = "sp.nat(1)" if is_uint
    if is_uint
      ctx.sink_list.push "#{a} = abs(#{a} - #{one})"
    else
      ctx.sink_list.push "#{a} = #{a} - #{one}"
    ctx.trim_expr = "#{a}"
  
  DELETE : (a, ctx, ast)->
    if ast.a.constructor.name != "Bin_op"
      throw new Error "can't compile DELETE operation for non 'delete a[b]' like construction. Reason not Bin_op"
    if ast.a.op != "INDEX_ACCESS"
      throw new Error "can't compile DELETE operation for non 'delete a[b]' like construction. Reason not INDEX_ACCESS"
    # BUG WARNING!!! re-walk can be dangerous (sink_list can be re-emitted)
    # protects from reinjection in sink_list
    nest_ctx = ctx.mk_nest()
    bin_op_a = walk ast.a.a, nest_ctx
    bin_op_b = walk ast.a.b, nest_ctx
    "remove #{bin_op_b} from map #{bin_op_a}"

# ###################################################################################################
#    type trans
# ###################################################################################################

@translate_type = translate_type = (type, ctx)->
  switch type.main
    # ###################################################################################################
    #    scalar
    # ###################################################################################################
    when "bool"
      "sp.TBool"

    when "Unit"
      "Unit"
        
    when "string"
      "sp.TString"
    
    when "address"
      "sp.TAddress"

    when "timestamp"
      "timestamp"

    when "operation"
      "operation"
    
    when "built_in_op_list"
      "list(operation)"
    
    when "list"
      nest = translate_type type.nest_list[0], ctx
      "list(#{nest})"
    # ###################################################################################################
    #    collections
    # ###################################################################################################
    when "array"
      nest   = translate_type type.nest_list[0], ctx
      "map(sp.TNat, #{nest})"
    
    when "tuple"
      list = []
      for v in type.nest_list
        list.push translate_type v, ctx
      # TODO FIXME
      if list.length == 0
        "unit"
      else
        "(#{list.join ' * '})"
    
    when "map"
      key   = translate_type type.nest_list[0], ctx
      value = translate_type type.nest_list[1], ctx
      "sp.TMap(#{key}, #{value})"
    
    when config.storage
      config.storage
    when "contract"
      if type.val
        "contract(#{type.val})"
      else
        type_list = []
        for type in type.nest_list
          translated_type = translate_type type, ctx
          type_list.push translated_type
        "contract(#{type_list.join ", "})"
    # when "t_bytes_memory_ptr"
    #   "bytes"
    # when config.storage
    #   config.storage
    else
      if ctx.type_decl_map?.hasOwnProperty type.main
        name = type.main.replace /\./g, "_"
        is_struct = ((ctx.current_class and ctx.type_decl_map["#{ctx.current_class.name}_#{name}"]) or ctx.type_decl_map[name]) and ctx.type_decl_map[name]?.constructor.name == "Class_decl"
        if ctx.current_class and is_struct 
          name = "#{ctx.current_class.name}_#{name}"
        name = translate_var_name name, ctx
        name
      else if type.main.match /^byte[s]?\d{0,2}$/
        "sp.TBytes"
      else if config.uint_type_map.hasOwnProperty type.main
        "sp.TNat"
      else if config.int_type_map.hasOwnProperty type.main
        "sp.TInt"
      # temporary hack for state
      else if type.main.match ///^#{config.storage}_///
        type.main
      # special case for synthetic types we know for sure will be there
      else if type.main.startsWith "@"
        type.main.substr(1)
      else
        perr "WARNING (Translate). translate_type unknown solidity type '#{type}'"
        "UNKNOWN_TYPE_#{type}"

@type2default_value = type2default_value = (type, ctx)->
  if config.uint_type_map.hasOwnProperty type.main
    return "sp.nat(0)"
  
  if config.int_type_map.hasOwnProperty type.main
    return "0"
  
  if config.bytes_type_map.hasOwnProperty type.main
    return "sp.bytes(\"0x00\")"
  
  switch type.main
    when "bool"
      "False"
    
    when "address"
      "sp.address(#{JSON.stringify config.burn_address})"
      # TODO FIXME
      # if !ctx.parent # we're in the top-level scope
      #   "sp.address(#{JSON.stringify config.burn_address})"
      # else
      #   "burn_address"
    
    when "built_in_op_list"
      "(nil: list(operation))"

    when "contract" # TODO FIXME
      "contract(unit)"
    
    when "map", "array"
      "sp.map()"
    
    when "string"
      '""'
    
    else
      # TODO FIXME
      if ctx.type_decl_map.hasOwnProperty type.main
        t = ctx.type_decl_map[type.main]
        # take very first value in enum as default
        if t.constructor.name == "Enum_decl"
          first_item = t.value_list[0].name
          if ctx.current_class.name
            # TODO this prefix is unused right now. Figure out if it should be prepended to enum's name
            prefix = ""
            if ctx.current_class.name
              prefix = "#{ctx.current_class.name}_"
            return "#{name}_#{first_item}"
          else
            return "#{name}(unit)"
        if t.constructor.name == "Class_decl"
          name = type.main
          if ctx.current_class?.name
            name = "#{ctx.current_class.name}_#{type.main}"
          return translate_var_name "#{name}_default", ctx

      perr "WARNING (Translate). Can't translate unknown Solidity type '#{type}'"
      "UNKNOWN_TYPE_DEFAULT_VALUE_#{type}"

# ###################################################################################################

class @Gen_context
  parent            : null
  next_gen          : null
  
  current_class     : null
  current_fn        : null
  is_class_scope    : false
  lvalue            : false
  type_decl_map    : {}
  contract_var_map : {}
  
  contract          : false
  trim_expr         : ""
  
  # terminates right side expression in case it doesn't return anything.
  # this might be needed cause LIGO doesn't support procedures
  terminate_expr_check    : "" 
  terminate_expr_replace_fn: null

  # in case expression should be split into multiple lines
  # code to be prepended collected here
  sink_list         : []
  tmp_idx           : 0
  
  # collect things to be placed at the top of the contract
  # storage_sink_list : {}
  type_decl_sink_list: []
  # structs_default_list: []
  enum_list: []

  # special fields for mode attempting file separation
  files             : null
  keep_dir_structure: false
  
  # for fix Ret_multi at non-last position of function
  scope_root : null
  
  constructor:()->
    @type_decl_map   = {}
    @contract_var_map= {}
    # @storage_sink_list= {}
    @sink_list        = []
    @type_decl_sink_list= []
    # @structs_default_list= []
    @enum_list= []
    @contract = false
    @files = null
    @keep_dir_structure = false
  
  mk_nest : ()->
    t = new module.Gen_context
    t.parent = @
    t.current_class = @current_class
    t.current_fn    = @current_fn
    obj_set t.contract_var_map, @contract_var_map
    obj_set t.type_decl_map, @type_decl_map
    t.type_decl_sink_list = @type_decl_sink_list # Common. All will go to top
    # t.structs_default_list = @structs_default_list
    t.enum_list = @enum_list
    t.contract = @contract
    t.files = @files
    t.keep_dir_structure = @keep_dir_structure
    t.scope_root = @scope_root
    t

last_bracket_state = false
walk = (root, ctx)->
  main_file = ""
  last_bracket_state = false
  switch root.constructor.name
    when "Scope"
      switch root.original_node_type
        when "SourceUnit" # top-level scope
          jls = {}
          jls[main_file] = []
          for v in root.list
            code = walk v, ctx
            path = if ctx.keep_dir_structure then v.file else null
            path ?= main_file
            if code
              jls[path] ?= []
              jls[path].push code
        
          # if ctx.structs_default_list.length
          #   jls[main_file].unshift """
          #     #{join_list ctx.structs_default_list}
          #     """
          name = config.storage
          jls[main_file].unshift "import smartpy as sp"
          # if Object.keys(ctx.storage_sink_list).length == 0
          #   jls[main_file].unshift """
          #     type #{name} is unit;
          #     """
          # else
          #   for k,v of ctx.storage_sink_list
          #     if v.length == 0
          #       jls[main_file].unshift """
          #         type #{k} is unit;
          #         """
          #     else
          #       jls[main_file].unshift """
          #         type #{k} is record
          #           #{join_list v, '  '}
          #         end;
          #         """
          # ctx.storage_sink_list = {} 

          if ctx.type_decl_sink_list.length
            if ctx.enum_list.length 
              jls[main_file].unshift ""
              jls[main_file].unshift """
                #{join_list ctx.enum_list}
                """
              ctx.enum_list = []
          for path, jl of jls
            ctx.files[path] = join_list jl, ""
          ctx.files[main_file]
        else # local scope
          if !root.original_node_type
            jls = {}
            jls[main_file] = []
            for v in root.list
              path = if ctx.keep_dir_structure then v.file else null
              path ?= main_file
              jls[path] ?= []
              code = walk v, ctx
              for loc_code in ctx.sink_list
                jls[path].push loc_code
              ctx.sink_list.clear()
              # do not add e.g. tmp_XXX stmt which do nothing
              if ctx.trim_expr == code
                ctx.trim_expr = ""
                continue
              if ctx.terminate_expr_check == code
                ctx.terminate_expr_check = ""
                code = ctx.terminate_expr_replace_fn()
              if code
                jls[path].push code

            for path, jl of jls
              if jl.length == 0
                code = "pass"
              else
                code = """
                  #{join_list jl, ""}
                  """
              ctx.files[path] = code

            ctx.files[main_file]
              
          else
            puts root
            throw new Error "Unknown root.original_node_type #{root.original_node_type}"
    # ###################################################################################################
    #    expr
    # ###################################################################################################
    when "Var"
      name = root.name
      return "" if name in ["this", "super"]
      if ctx.contract_var_map.hasOwnProperty name
        "self.data.#{name}"
      else
        if ctx.current_fn.arg_name_list.has name
          name
        else
          "#{name}.value"
        # TODO?
        # spec_id_translate root.name, name
    
    when "Const"
      if !root.type
        puts root
        throw new Error "Can't type inference"
      
      if config.uint_type_map.hasOwnProperty root.type.main
        return "sp.nat(#{root.val})"
      
      switch root.type.main
        when "bool"
          switch root.val
            when "true"
              "True"
            when "false"
              "False"
            else
              throw new Error "can't translate bool constant '#{root.val}'"
        when "Unit"
          "unit"
        
        when "number"
          perr "WARNING (Translate). Number constant passed to the translation stage. That's a type inference mistake"
          module.warning_counter++
          root.val
        
        when "unsigned_number"
          "sp.nat(#{root.val})"

        when "mutez"
          "sp.mutez(#{root.val})"
        
        when "string"
          JSON.stringify root.val
        when "built_in_op_list"
          if root.val
            "#{root.val}"
          else
            "(nil: list(operation))"
        else
          if config.bytes_type_map.hasOwnProperty root.type.main
            number2bytes root.val, +root.type.main.replace(/bytes/, '')
          else
            root.val

    # when "Contract"
    #   if !root.type
    #     puts root
    #     throw new Error "Can't type inference"
      
    #   "contract((#{root.type.main}))"
    
    when "Bin_op"
      # TODO lvalue ctx ???
      ctx_lvalue = ctx.mk_nest()
      ctx_lvalue.lvalue = true if 0 == root.op.indexOf "ASS"
      _a = walk root.a, ctx_lvalue
      ctx.sink_list.append ctx_lvalue.sink_list
      _b = walk root.b, ctx
      
      ret = if op = module.bin_op_name_map[root.op]
        last_bracket_state = true
        if ((root.a.type && root.a.type.main == 'bool') || ( root.b.type &&root.b.type.main == 'bool')) and op in ['>=', '=/=', '<=','>','<','=']
          switch op
            when "="
              "(#{_a} = #{_b})"
            when "=/="
              "(#{_a} =/= #{_b})"
            when ">"
              "(#{_a} and not #{_b})"
            when "<" 
              "((not #{_a}) and #{_b})"
            when ">="
              "(#{_a} or not #{_b})"
            when "<="
              "((not #{_a}) or #{_b})"
            else
              "(#{_a} #{op} #{_b})"
        else
          "(#{_a} #{op} #{_b})"
      else if cb = module.bin_op_name_cb_map[root.op]
        cb(_a, _b, ctx, root)
      else
        throw new Error "Unknown/unimplemented bin_op #{root.op}"
    
    when "Un_op"
      a = walk root.a, ctx
      if cb = module.un_op_name_cb_map[root.op]
        cb a, ctx, root
      else
        throw new Error "Unknown/unimplemented un_op #{root.op}"
    
    when "Field_access"
      t = walk root.t, ctx
      if !root.t.type
        perr "WARNING (Translate). Some of types in Field_access aren't resolved. This can cause invalid code generated"
      else
        switch root.t.type.main
          when "array"
            switch root.name
              when "length"
                return "sp.len(#{t})"
              
              else
                throw new Error "unknown array field #{root.name}"
          
          when "bytes"
            switch root.name
              when "length"
                return "sp.len(#{t})"
              
              else
                throw new Error "unknown array field #{root.name}"
          
          when "enum"
            return root.name
      
      # else
      if t == "" # this case
        return root.name
      
      chk_ret = "#{t}.#{root.name}"
      ret = "#{t}.#{root.name}"
      if root.t.constructor.name == "Var"
        if ctx.type_decl_map[root.t.name]?.is_library
          ret = translate_var_name "#{t}_#{root.name}", ctx
      
      spec_id_translate chk_ret, ret
    
    when "Fn_call"
      arg_list = []
      for v in root.arg_list
        arg_list.push walk v, ctx
      
      field_access_translation = null
      if root.fn.constructor.name == "Field_access"
        field_access_translation =  walk root.fn.t, ctx
        if root.fn.t.type
          switch root.fn.t.type.main
            when "array"
              switch root.fn.name
                when "push"
                  tmp_var = "tmp_#{ctx.tmp_idx++}"
                  ctx.sink_list.push "const #{tmp_var} : #{translate_type root.fn.t.type, ctx} = #{field_access_translation};"
                  return "#{tmp_var}[size(#{tmp_var})] = #{arg_list[0]}"
                
                else
                  throw new Error "unknown array field function #{root.fn.name}"
            
      if root.fn.constructor.name == "Var"
        switch root.fn.name
          when "require", "assert", "require2"
            cond= arg_list[0]
            str = arg_list[1]
            if str
              # TODO look for better message throw
              return "sp.verify(#{cond}, #{str})"
            else 
              return "sp.verify(#{cond})"
          
          when "revert"
            str = arg_list[0] or '"revert"'
            return "sp.failwith(#{str})"
          
          when "sha512" # TODO add to type inference
            msg = arg_list[0]
            return "sp.sha512(#{msg})"
          
          when "sha256"
            msg = arg_list[0]
            return "sp.sha256(#{msg})"
          
          when "sha3", "keccak256"
            perr "WARNING (Translate). #{root.fn.name} hash function will be translated as sha_256. Read more: https://github.com/madfish-solutions/sol2ligo/wiki/Known-issues#hash-functions"
            msg = arg_list[0]
            return "sp.sha256(#{msg})"

          when "selfdestruct"
            perr "WARNING (Translate). #{root.fn.name} does not exist in LIGO. Statement translated as is"
            msg = arg_list[0]
            return "selfdestruct(#{msg}) (* unsupported *)"

          when "blockhash"
            msg = arg_list[0]
            perr "WARNING (Translate). #{root.fn.name} does not exist in LIGO. We replaced it with sp.bytes(\"#{msg}\")."
            return "sp.bytes(\"0x00\") # Should be blockhash of #{msg}"
          
          when "ripemd160"
            perr "WARNING (Translate). #{root.fn.name} hash function will be translated as blake2b. Read more: https://github.com/madfish-solutions/sol2ligo/wiki/Known-issues#hash-functions"
            msg = arg_list[0]
            return "sp.blake2b(#{msg})"
          
          when "ecrecover"
            perr "WARNING (Translate). ecrecover function does not exist in LIGO. Read more: https://github.com/madfish-solutions/sol2ligo/wiki/Known-issues#ecrecover"
            # do not mangle, because it can be user-defined function
            fn = "ecrecover"
          
          # when "@respond"
          #   type_list = []
          #   for v in root.arg_list
          #     type_list.push translate_type v.type, ctx
          #   type_str = type_list.join " * "
          #   # TODO config match_action, config.callback_address
          #   return "var #{config.op_list} : list(operation) = list transaction((#{arg_list.join ' * '}), 0mutez, (get_contract(match_action.#{config.callback_address}) : contract(#{type_str}))) end"
          # 
          # when "@respond_append"
          #   type_list = []
          #   for v in root.arg_list
          #     type_list.push translate_type v.type, ctx
          #   type_str = type_list.join " * "
          #   return "var #{config.op_list} : list(operation) = cons(#{arg_list[0]}, list transaction((#{arg_list[1..].join ' * '}), 0mutez, (get_contract(match_action.#{config.callback_address}) : contract(#{type_str}))) end)"
          
          else
            fn = root.fn.name
      else
        fn = walk root.fn, ctx
      
      call_expr = "#{fn}(#{arg_list.join ', '})"
      
      if not root.left_unpack or fn in ["get_contract", "transaction"]
        call_expr
      else
        if root.fn_decl
          {
            returns_op_list
            uses_storage
            modifies_storage
            returns_value
          } = root.fn_decl
          {type_o} = root.fn_decl
          if root.is_fn_decl_from_using
            # TODO same for op list
            shift_self = arg_list.shift() if uses_storage
            arg_list.unshift field_access_translation
            arg_list.unshift shift_self   if uses_storage
            call_expr = "#{root.fn_name_using}(#{arg_list.join ', '})"
        else if type_decl = ti_map[root.fn.name]
          returns_op_list = false
          modifies_storage= false
          returns_value   = type_decl.nest_list[1].nest_list.length > 0
          type_o          = type_decl.nest_list[1]
        else if ctx.contract_var_map.hasOwnProperty root.fn.name
          decl = ctx.contract_var_map[root.fn.name]
          return call_expr if decl.constructor.name == "Fn_decl_multiret"
          return "#{config.contract_storage}.#{root.fn.name}"
        else
          perr "WARNING (Translate). !root.fn_decl #{root.fn.name}"
          return call_expr
        
        ret_types_list = []
        for v in type_o.nest_list
          ret_types_list.push translate_type v, ctx
        
        if ret_types_list.length == 0
          call_expr
        else if ret_types_list.length == 1 and returns_value
          ctx.terminate_expr_replace_fn = ()->
            perr "WARNING (Translate). #{call_expr} was terminated with dummy variable declaration"
            tmp_var = "terminate_tmp_#{ctx.tmp_idx++}"
            "const #{tmp_var} : (#{ret_types_list.join ' * '}) = #{call_expr}"
          ctx.terminate_expr_check = call_expr
        else
          if ret_types_list.length == 1
            # no tmp_var
            if returns_op_list
              "#{config.op_list} = #{call_expr}"
            else if modifies_storage
              "#{config.contract_storage} = #{call_expr}"
            else
              throw new Error "WTF !returns_op_list !modifies_storage"
          else
            tmp_var = "tmp_#{ctx.tmp_idx++}"
            ctx.sink_list.push "const #{tmp_var} : (#{ret_types_list.join ' * '}) = #{call_expr}"
            
            arg_num = 0
            get_tmp = ()->
              if ret_types_list.length == 1
                tmp_var
              else
                "#{tmp_var}.#{arg_num++}"
            
            if returns_op_list
              ctx.sink_list.push "#{config.op_list} = #{get_tmp()}"
            if modifies_storage
              ctx.sink_list.push "#{config.contract_storage} = #{get_tmp()}"
              
            ctx.trim_expr = get_tmp()
    
    when "Struct_init"
      arg_list = []
      for i in [0..root.val_list.length-1]
        arg_list.push "#{root.arg_names[i]} = #{walk root.val_list[i], ctx}"
      "sp.record(#{arg_list.join ', '})"

    when "Type_cast"
      target_type = translate_type root.target_type, ctx
      t = walk root.t, ctx
      if t == "" and target_type == "sp.TAddress"
        return "self_address"
      
      if target_type == "sp.TInt"
        "sp.int(abs(#{t}))"
      else if target_type == "sp.TNat"
        "abs(#{t})"
      else if target_type == "sp.TAddress" and t == "0"
        type2default_value root.target_type, ctx
      else if target_type == "sp.TBytes" and root.t.type?.main == "string"
        "sp.pack(#{t})"
      else if target_type == "sp.TAddress" and (t == "0x0" or t == "0")
        # TODO FIXME
        # "burn_address"
        "sp.address(#{JSON.stringify config.burn_address})"
      else
        # HACK
        if /^sp\.T/.test target_type
          target_type = target_type.replace /^sp\.T/, "sp."
          target_type = target_type.toLowerCase()
        
        "#{target_type}(#{t})"
    
    # ###################################################################################################
    #    stmt
    # ###################################################################################################
    when "Comment"
      if ctx.keep_dir_structure and root.text.startsWith "#include"
        text = root.text.replace ".sol", ".ligo"
        text
      else if root.can_skip
        ""
      else
        "pass # #{root.text.replace /[\n\r]/g, ''}"
    
    when "Continue"
      # TODO FIX
      "(* `continue` statement is not supported in LIGO *)"
    
    when "Break"
      # TODO FIX
      "(* `break` statement is not supported in LIGO *)"
    
    when "Var_decl"
      name = root.name
      type = translate_type root.type, ctx
      if ctx.is_class_scope and !root.is_const
        ctx.contract_var_map[name] = root
        ""
      else
        if root.assign_value
          val = walk root.assign_value, ctx
          if config.bytes_type_map.hasOwnProperty(root.type.main) and root.assign_value.type.main == "string" and root.assign_value.constructor.name == "Const"
            val = string2bytes root.assign_value.val
          if config.bytes_type_map.hasOwnProperty(root.type.main) and root.assign_value.type.main == "number" and root.assign_value.constructor.name == "Const"
            val = number2bytes root.assign_value.val
        else
          val = type2default_value root.type, ctx
        
        if ctx.current_fn
          """
          #{name} = sp.local(#{JSON.stringify name}, #{val})
          """
        else
          """
          #{name} = #{val}
          """
    
    when "Var_decl_multi"
      # TODO FIX
      if root.assign_value
        val = walk root.assign_value, ctx
        tmp_var = "tmp_#{ctx.tmp_idx++}"
        
        jl = []
        type_list = []
        for _var, idx in root.list
          {name} = _var
          type_list.push type = translate_type _var.type, ctx
          jl.push """
          const #{name} : #{type} = #{tmp_var}.#{idx};
          """
        
        """
        const #{tmp_var} : (#{type_list.join ' * '}) = #{val};
        #{join_list jl}
        """
      else
        perr "WARNING (Translate). Var_decl_multi with no assign value should be unreachable, but something went wrong"
        module.warning_counter++
        jl = []
        for _var in root.list
          {name} = _var
          type = translate_type root.type, ctx
          jl.push """
          const #{name} : #{type} = #{type2default_value _var.type, ctx}
          """
        jl.join "\n"
    
    when "Throw"
      if root.t
        t = walk root.t, ctx
        "sp.failwith(#{t})"
      else
        'sp.failwith("throw")'
    
    when "Ret_multi"
      jl = []
      for v,idx in root.t_list
        jl.push walk v, ctx
      
      if ctx.scope_root.constructor.name == "Fn_decl_multiret"
        # TODO fix bug in router, that return value is tuple
        if ctx.scope_root.name != "main"
          for type, idx in ctx.scope_root.type_o.nest_list
            if !root.t_list[idx]
              jl.push type2default_value type, ctx
        
        if ctx.current_fn.visibility not in ["private", "internal"]
          perr "WARNING (Translate). entry points cannot have return statements."
          """
          pass # return #{jl.join ', '} # entry points cannot have return statements.
          """
        else
          """
          sp.result(#{jl.join ', '})
          """
      else
        perr "WARNING (Translate). Return at non end-of-function position is prohibited"
        """
        sp.failwith("return at non end-of-function position is prohibited")
        """#"
    
    when "If"
      cond = walk root.cond,  ctx
      cond = "(#{cond})" if !last_bracket_state
      old_scope_root = ctx.scope_root
      ctx.scope_root = root
      t    = walk root.t,     ctx
      f    = walk root.f,     ctx
      ctx.scope_root = old_scope_root
      
      t = "pass" if !t
      ret = """
        sp.if #{cond}:
          #{make_tab t, '  '}
        """
      if f
        ret = """
          #{ret}
          sp.else:
            #{make_tab f, '  '}
          """
      ret
    
    when "While"
      cond = walk root.cond,  ctx
      cond = "(#{cond})" if !last_bracket_state
      old_scope_root = ctx.scope_root
      ctx.scope_root = root
      scope= walk root.scope, ctx
      ctx.scope_root = old_scope_root
      """
      sp.while #{cond}:
        #{make_tab scope, '  '};
      """
      
    when "PM_switch"
      cond = walk root.cond, ctx
      ctx = ctx.mk_nest()
      jl = []
      for _case in root.scope.list
        case_scope = walk _case.scope, ctx
        case_scope = case_scope[0..-2] if /;$/.test case_scope
        
        jl.push "| #{_case.struct_name}(#{_case.var_decl.name}) -> #{case_scope}"
      
      if jl.length
        """
        case #{cond} of
        #{join_list jl, ''}
        end
        """
      else
        "unit"
    
    when "Fn_decl_multiret"
      orig_ctx = ctx
      ctx = ctx.mk_nest()
      ctx.current_fn = root
      arg_jl = ["self"]
      for v in root.arg_name_list
        arg_jl.push translate_var_name v, ctx
      
      ctx.scope_root = root
      body = walk root.scope, ctx
      
      if root.arg_name_list.length
        aux_init_type_jl = []
        for v,idx in root.arg_name_list
          type = translate_type root.type_i.nest_list[idx], ctx
          name = translate_var_name v, ctx
          aux_init_type_jl.push "sp.set_type(#{name}, #{type})"
        body = """
          #{aux_init_type_jl.join '\n'}
          #{body}
          """
      
      ret = """
        def #{root.name}(#{arg_jl.join ', '}):
          #{make_tab body, '  '}
        """
      if root.visibility in ["private", "internal"]
        # TODO private_entry_point -> global_lambda + patch self call
        # BUT missing 1 required positional argument: 'b0'
        ret = """
          @sp.private_entry_point
          #{ret}
          """
      else
        ret = """
          @sp.entry_point
          #{ret}
          """
      ret
    
    when "Class_decl"
      return "" if root.need_skip
      return "" if root.is_interface # skip for now
      return "" if root.is_contract and !root.is_last
      orig_ctx = ctx
      prefix = ""
      if ctx.parent and ctx.current_class and root.namespace_name
        ctx.parent.type_decl_map["#{ctx.current_class.name}.#{root.name}"] = root
        prefix = ctx.current_class.name
      
      ctx.type_decl_map[root.name] = root
      
      ctx = ctx.mk_nest()
      ctx.current_class = root
      ctx.is_class_scope = true
      
      # stage 0 collect types
      for v in root.scope.list
        switch v.constructor.name
          when "Enum_decl", "Class_decl"
            ctx.type_decl_map[v.name] = v
          when "PM_switch"
            for _case in root.scope.list
              ctx.type_decl_map[_case.var_decl.type.main] = _case.var_decl
      
          else
            "skip"
      # stage 1 collect declarations
      field_decl_jl = []
      fn_decl_jl = []
      for v in root.scope.list
        switch v.constructor.name
          when "Var_decl"
            if !v.is_const
              field_decl_jl.push walk v, ctx
            else
              ctx.sink_list.push walk v, ctx
          
          when "Fn_decl_multiret"
            # ctx.contract_var_map[v.name] = v
            "skip"
          
          when "Enum_decl"
            "skip"
          
          when "Class_decl"
            code = walk v, ctx
            ctx.sink_list.push code if code
          
          when "Comment"
            ctx.sink_list.push walk v, ctx
          
          when "Event_decl"
            ctx.sink_list.push walk v, ctx
          
          else
            throw new Error "unknown v.constructor.name #{v.constructor.name}"
      
      jl = []
      jl.append ctx.sink_list
      ctx.sink_list.clear()
      
      # stage 2 collect fn implementations
      for v in root.scope.list
        switch v.constructor.name
          when "Var_decl"
            "skip"
          
          when "Enum_decl"
            jl.unshift walk v, ctx

          when "Fn_decl_multiret"
            fn_decl_jl.push walk v, ctx
          
          when "Class_decl", "Comment", "Event_decl"
            "skip"
          
          else
            throw new Error "unknown v.constructor.name #{v.constructor.name}"
      
      if root.is_contract or root.is_library
        state_name = config.storage
        # orig_ctx.storage_sink_list[state_name] ?= []
        # orig_ctx.storage_sink_list[state_name].append field_decl_jl
        arg_list = ["self"]
        arg_assign_pair_list = []
        type_decl_jl = []
        for k,v of ctx.contract_var_map
          arg_list.push k
          arg_assign_pair_list.push "#{k}=#{k}"
          type_decl_jl.push "#{k}=#{translate_type v.type, ctx}"
        name = root.name
        name = translate_var_name name, ctx
        
        aux_init_type_code = ""
        if type_decl_jl.length
          type_decl_code = type_decl_jl.join ",\n"
          aux_init_type_code = """
            self.init_type(
              sp.TRecord(
                #{make_tab type_decl_code, '    '}
              )
            )
            """
        
        fn_code = fn_decl_jl.join "\n\n"
        jl.unshift """
          class #{name}(sp.Contract):
            def __init__(#{arg_list.join ', '}):
              #{make_tab aux_init_type_code, '    '}
              self.init(#{arg_assign_pair_list.join ', '})
            
            #{make_tab fn_code, '  '}
          
          """
      else
        name = root.name
        if prefix
          name = "#{prefix}_#{name}"
        name = translate_var_name name, ctx
        # if root.is_struct 
        #   arg_list = []
        #   for v in root.scope.list
        #     arg_list.push "#{v.name} = #{type2default_value v.type, ctx}"
        #   ctx.structs_default_list.push "const #{name}_default : #{name} = record [ #{arg_list.join ";\n  "} ];\n"
        ctx.type_decl_sink_list.push {
          name
          field_decl_jl
        }
      
      jl.join "\n\n"
    
    when "Enum_decl"
      jl = []
      for v, idx in root.value_list
        ctx.contract_var_map[v.name] = v
        
        # not covered by tests yet
        aux = ""
        if v.type
          aux = " of #{translate_var_name v.type.main.replace /\./g, "_", ctx}"
        jl.push "| #{v.name}#{aux}"

      if jl.length
        entry = join_list jl, ' '
      else
        entry = "unit"
      """
      type #{root.name} is
        #{entry};
      """
    
    when "Ternary"
      cond = walk root.cond,  ctx
      t    = walk root.t,     ctx
      f    = walk root.f,     ctx
      # Doesn't work #{t} if #{cond} else #{f}
      # Exception while executing Ternary()
      
      # use obscure variant from https://book.pythontips.com/en/latest/ternary_operators.html
      # same Exception while executing Ternary()
      # (#{t}, #{f})[#{cond}]
      """
      #{t} if #{cond} else #{f}
      """
    
    when "New"
      # TODO: should we translate type here?
      arg_list = []
      for v in root.arg_list
        arg_list.push walk v, ctx
      
      args = """#{join_list arg_list, ', '}"""
      translated_type = translate_type root.cls, ctx
      
      if root.cls.main == "array"
        # Python doesn't have multiline comments that are NOT skippable token
        # throw out (* args: #{args} *)
        """sp.map()"""
      else if translated_type == "sp.TBytes"
        # single line comments will damage code
        # throw out # args: #{args}
        """sp.bytes(\"0x00\")"""
      else
        """
        #{translated_type}(#{args})
        """
    
    when "Tuple"
      #TODO does this even work?
      arg_list = []
      for v in root.list
        arg_list.push walk v, ctx
      "(#{arg_list.join ', '})"
    
    when "Array_init"
      arg_list = []
      for v in root.list
        arg_list.push walk v, ctx
      
      if root.type.main == "built_in_op_list"
        """list [#{arg_list.join "; " }]"""
      else
        decls = []
        for arg, i in arg_list
          decls.push("#{i}n -> #{arg};")
        """
        map
          #{join_list decls, '  '}
        end
        """
    
    when "Event_decl"
      args = []
      for arg in root.arg_list
        name = arg._name
        type = translate_type arg, ctx
        args.push "#{name} : #{type}"
      """
      (* EventDefinition #{root.name}(#{args.join('; ')}) *)
      """
    
    when "Include"
      """#include \"#{root.path}\""""

    else
      if ctx.next_gen?
        ctx.next_gen root, ctx
      else
        # TODO gen extentions
        perr root
        throw new Error "Unknown root.constructor.name #{root.constructor.name}"

@gen = (root, opt = {})->
  ctx = new module.Gen_context
  ctx.next_gen = opt.next_gen
  ctx.keep_dir_structure = opt.keep_dir_structure
  ctx.files = {}
  ret = walk root, ctx
  if opt.keep_dir_structure
    ctx.files[""]
  else
    ret
