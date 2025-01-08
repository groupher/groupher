#!/bin/bash

project_path="./src"
export LC_NUMERIC=C

temp_summary=$(mktemp)

while IFS= read -r file_path; do
    if [[ $file_path == *"/styles/"* ]] && [[ $file_path == *".ts" ]]; then
        group=$(echo "$file_path" | sed -E 's|.*/src/(.*/styles/).*|\1|')
        size=$(stat -f%z "$file_path")
        size_kb=$(echo "scale=2; $size/1024" | bc)
        
        if grep -q "^$group" "$temp_summary"; then
            current_size=$(grep "^$group" "$temp_summary" | cut -d' ' -f2)
            new_size=$(echo "$current_size + $size_kb" | bc)
            sed -i '' "s|^$group.*|$group $new_size|" "$temp_summary"
        else
            echo "$group $size_kb" >> "$temp_summary"
        fi
    fi
done < <(find "$project_path" -type f | sort)

total_size=$(awk '{sum += $2} END {print sum}' "$temp_summary")

# 找出最长的组件名长度
max_length=$(awk '{print length($1)}' "$temp_summary" | sort -rn | head -1)
max_length=$((max_length - 7))  # 减去 "styles/"的长度

echo "Summary Table (Sorted by Size):"
echo "+$(printf '%*s' $((max_length+2)) | tr ' ' '-')-+------------+"
echo "| Component$(printf '%*s' $((max_length-8)) ) | Size (KB)  |"
echo "+$(printf '%*s' $((max_length+2)) | tr ' ' '-')-+------------+"
sort -rnk2 "$temp_summary" | while read -r component size; do
    component_name=${component%styles/}
    component_name=${component_name%/}
    printf "| %-${max_length}s | %10.2f |\n" "$component_name" "$size"
done
echo "+$(printf '%*s' $((max_length+2)) | tr ' ' '-')-+------------+"
printf "| %-${max_length}s | %10.2f |\n" "Total" "$total_size"
echo "+$(printf '%*s' $((max_length+2)) | tr ' ' '-')-+------------+"

rm "$temp_summary"

