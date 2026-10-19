# 模糊圖示資產記錄

製作工具：內建 imagegen（非 CLI）。
輸入：使用者在本聊天提供的競選圖示。
專案資產：dist/assets/merch-mark-blurred.png。
用途：3D 提袋、帽子、徽章和吊飾的印刷材質。
處理結果：保留藍、黑、黃的大致色塊與構圖，文字及圖案輪廓強烈模糊，無法辨讀。清晰原圖沒有複製到專案或發佈包。

## 完整提示詞

Edit target: the supplied square graphic. Produce a single square white print texture for a 3D game. Preserve the original graphic's general placement, cyan/light-blue swooshes, dark-blue circular mark, black diagonal text mass, and yellow accent. Apply a strong consistent optical Gaussian-style blur over EVERY part of the graphic, including all black lettering and yellow lettering. All text must be unreadable and all outlines soft. The viewer should perceive only diffuse cyan, blue, black and yellow color shapes in approximately the original layout. Do not add any readable text, new logos, objects, borders, scenery, mockups, or sharp details. Keep white background. This blurred version is intentionally used to obscure the identity of the campaign design on small 3D merchandise.
