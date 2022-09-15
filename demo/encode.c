#include <brotli/encode.h>

int encodeWithDict(int quality, int lgwin, int mode,
           size_t input_size, const uint8_t* input_buffer,
           size_t dict_size, const uint8_t* dictbuffer,
           size_t encoded_size, uint8_t* encoded_buffer) {
  size_t available_in = input_size;
  const uint8_t* next_in = input_buffer;
  size_t available_out = encoded_size;
  uint8_t* next_out = encoded_buffer;
  size_t total_out = 0;

  BrotliEncoderPreparedDictionary* prepared_dictionary;
  if (dictbuffer) {
    prepared_dictionary = BrotliEncoderPrepareDictionary(
        BROTLI_SHARED_DICTIONARY_RAW, dict_size,
        dictbuffer, BROTLI_MAX_QUALITY, NULL, NULL, NULL);
    if (prepared_dictionary == NULL) {
      return -1;
    }
  }
  BrotliEncoderState* s = BrotliEncoderCreateInstance(NULL, NULL, NULL);
  if (prepared_dictionary != NULL) {
    BrotliEncoderAttachPreparedDictionary(s, prepared_dictionary);
  }
  BrotliEncoderSetParameter(s, BROTLI_PARAM_QUALITY, quality);
  BrotliEncoderSetParameter(s, BROTLI_PARAM_LGWIN, lgwin);
  BrotliEncoderSetParameter(s, BROTLI_PARAM_MODE, mode);
  BrotliEncoderSetParameter(s, BROTLI_PARAM_SIZE_HINT, input_size);
  if (lgwin > BROTLI_MAX_WINDOW_BITS) {
    BrotliEncoderSetParameter(s, BROTLI_PARAM_LARGE_WINDOW, BROTLI_TRUE);
  }
  BROTLI_BOOL result = BROTLI_FALSE;
  result = BrotliEncoderCompressStream(s, BROTLI_OPERATION_FINISH,
      &available_in, &next_in, &available_out, &next_out, &total_out);
  if (!BrotliEncoderIsFinished(s)) {
    result = BROTLI_FALSE;
  }

  BrotliEncoderDestroyInstance(s);

  if (prepared_dictionary != NULL) {
    BrotliEncoderDestroyPreparedDictionary(prepared_dictionary);
  }
  if (result == BROTLI_FALSE)
    return -1;
  return total_out;
}

int encode(int quality, int lgwin, int mode,
           size_t input_size, const uint8_t* input_buffer,
           size_t encoded_size, uint8_t* encoded_buffer) {
  return encodeWithDict(quality, lgwin, mode, input_size, input_buffer,
                        0, NULL, encoded_size, encoded_buffer);
}
