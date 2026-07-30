# Conversion fixtures

The conversion suite generates small, valid DOCX, PDF, PPTX, and XLSX files in
`tests/conftest.py`. Keeping the fixture builders in source makes their content
reviewable and avoids committing opaque binary archives while still exercising
MarkItDown's real format converters through the multipart API.
