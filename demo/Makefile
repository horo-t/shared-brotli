CPP = emcc
CPPFLAGS = -O3 -s WASM=1 -s TOTAL_MEMORY=327680000 -s NO_FILESYSTEM=1

COMMON_DIR = third_party/brotli/c/common
ENC_DIR = third_party/brotli/c/enc
ENC_SRC = encode.c \
          $(wildcard $(COMMON_DIR)/*.c) \
				  $(wildcard $(ENC_DIR)/*.c)
ENC_OBJ = $(ENC_SRC:.c=.o)

all: encode.js

.c.o .cc.o:
	$(CPP) -I third_party/brotli/c/include -c $< -o $@

encode.js: $(ENC_OBJ)
	$(CPP) $(CPPFLAGS) \
	  -s EXPORTED_FUNCTIONS="['_encode','_encodeWithDict','_malloc','_free']" \
		-s EXPORTED_RUNTIME_METHODS="['addOnInit']" \
		$(ENC_OBJ) \
		-o encode.js

clean:
	rm -rf $(ENC_OBJ) encode.js encode.wasm
