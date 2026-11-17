import os
import sys

# Prevent OpenMP runtime conflict on Windows
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["LOKY_MAX_CPU_COUNT"] = "4"
