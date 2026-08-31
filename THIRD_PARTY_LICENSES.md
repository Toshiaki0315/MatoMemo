# サードパーティライセンス一覧

MatoMemo は多くのオープンソースソフトウェアの上に成り立っています。
本ファイルは、配布される MatoMemo アプリケーションに含まれる依存関係と
そのライセンスの一覧です。

> このファイルは `npm run licenses` により自動生成されます。手で編集しないでください。
> 依存を追加・更新したら再生成してください（CI が陳腐化を検出します）。
>
> 対象は**配布物に含まれる依存のみ**です。ビルドツールやテストフレームワーク
> （Vite, Vitest, TypeScript, cargo のビルド依存など）は成果物に含まれないため
> 除外しています。

MatoMemo 自体のライセンスは [MIT License](./LICENSE) です。

## 概要

合計 255 パッケージ（Rust 246 / npm 9）。

| ライセンス | 件数 |
| --- | --- |
| MIT OR Apache-2.0 | 112 |
| MIT | 43 |
| Apache-2.0 OR MIT | 27 |
| Unicode-3.0 | 18 |
| Zlib OR Apache-2.0 OR MIT | 14 |
| MIT/Apache-2.0 | 13 |
| MPL-2.0 | 5 |
| Unlicense OR MIT | 5 |
| BSD-3-Clause | 2 |
| MIT OR Apache-2.0 OR Zlib | 2 |
| MIT OR Zlib OR Apache-2.0 | 2 |
| Unlicense/MIT | 2 |
| Zlib | 2 |
| (MIT OR Apache-2.0) AND Unicode-3.0 | 1 |
| 0BSD OR MIT OR Apache-2.0 | 1 |
| Apache-2.0 | 1 |
| Apache-2.0 / MIT | 1 |
| Apache-2.0 AND MIT | 1 |
| BSD-3-Clause AND MIT | 1 |
| BSD-3-Clause/MIT | 1 |
| CC0-1.0 OR MIT-0 OR Apache-2.0 | 1 |

いずれも許諾的（permissive）または弱いコピーレフトのライセンスであり、
MatoMemo を MIT License で配布することと両立します。GPL / AGPL などの
強いコピーレフトライセンスの依存はありません。

## 弱いコピーレフトライセンスを含む依存 (5)

以下のパッケージはファイル単位のコピーレフトライセンスです。**該当ファイル自体を
改変した場合にのみ**そのソース開示義務が生じます。改変せずにライブラリとして
利用・リンクする分には、MatoMemo 本体を MIT で配布することと両立します
（MPL-2.0 第 3.3 条が「より大きな著作物」を別ライセンスで配布することを明示的に許諾）。

MatoMemo はこれらのパッケージを一切改変していません。

| パッケージ | バージョン | ライセンス |
| --- | --- | --- |
| cssparser | 0.36.0 | MPL-2.0 |
| cssparser-macros | 0.6.1 | MPL-2.0 |
| dtoa-short | 0.3.5 | MPL-2.0 |
| option-ext | 0.2.0 | MPL-2.0 |
| selectors | 0.36.1 | MPL-2.0 |

## Rust クレート (246)

`src-tauri` のバイナリにリンクされるクレートです。
`cargo metadata --filter-platform aarch64-apple-darwin` の解決グラフを
normal 依存のみ辿って抽出しています。

| パッケージ | バージョン | ライセンス | 著作権表示 |
| --- | --- | --- | --- |
| [adler2](https://github.com/oyvindln/adler2) | 2.0.1 | 0BSD OR MIT OR Apache-2.0 | Copyright (C) Jonas Schievink <jonasschievink@gmail.com> |
| [aho-corasick](https://github.com/BurntSushi/aho-corasick) | 1.1.5 | Unlicense OR MIT | Copyright (c) 2015 Andrew Gallant |
| [alloc-no-stdlib](https://github.com/dropbox/rust-alloc-no-stdlib) | 2.0.4 | BSD-3-Clause | Copyright (c) 2016 Dropbox, Inc. |
| [alloc-stdlib](https://github.com/dropbox/rust-alloc-no-stdlib) | 0.2.4 | BSD-3-Clause | — |
| [anyhow](https://github.com/dtolnay/anyhow) | 1.0.104 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [base64](https://github.com/marshallpierce/rust-base64) | 0.21.7 | MIT OR Apache-2.0 | Copyright (c) 2015 Alice Maz |
| [base64](https://github.com/marshallpierce/rust-base64) | 0.22.1 | MIT OR Apache-2.0 | Copyright (c) 2015 Alice Maz |
| [bit-set](https://github.com/contain-rs/bit-set) | 0.8.0 | Apache-2.0 OR MIT | Copyright (c) 2023 The Rust Project Developers |
| [bit-vec](https://github.com/contain-rs/bit-vec) | 0.8.0 | Apache-2.0 OR MIT | Copyright (c) 2023 The Rust Project Developers |
| [bitflags](https://github.com/bitflags/bitflags) | 2.13.1 | MIT OR Apache-2.0 | Copyright (c) 2014 The Rust Project Developers |
| [bitflags](https://github.com/bitflags/bitflags) | 1.3.2 | MIT/Apache-2.0 | Copyright (c) 2014 The Rust Project Developers |
| [block-buffer](https://github.com/RustCrypto/utils) | 0.10.4 | MIT OR Apache-2.0 | Copyright (c) 2018-2019 The RustCrypto Project Developers |
| [block2](https://github.com/madsmtm/objc2) | 0.6.2 | MIT | — |
| [brotli](https://github.com/dropbox/rust-brotli) | 8.0.4 | BSD-3-Clause AND MIT | Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors. |
| [brotli-decompressor](https://github.com/dropbox/rust-brotli-decompressor) | 5.0.3 | BSD-3-Clause/MIT | Copyright (c) 2016 Dropbox, Inc. |
| [bs58](https://github.com/Nullus157/bs58-rs) | 0.5.1 | MIT/Apache-2.0 | Copyright (c) 2016 The roaring-rs developers. |
| [byteorder](https://github.com/BurntSushi/byteorder) | 1.5.0 | Unlicense OR MIT | Copyright (c) 2015 Andrew Gallant |
| [bytes](https://github.com/tokio-rs/bytes) | 1.12.1 | MIT | Copyright (c) 2018 Carl Lerche |
| [camino](https://github.com/camino-rs/camino) | 1.2.5 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [cargo_metadata](https://github.com/oli-obk/cargo_metadata) | 0.19.2 | MIT | — |
| [cargo-platform](https://github.com/rust-lang/cargo) | 0.1.9 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [cfb](https://github.com/mdsteele/rust-cfb) | 0.7.3 | MIT | Copyright (c) 2017 Matthew D. Steele |
| [cfg-if](https://github.com/rust-lang/cfg-if) | 1.0.4 | MIT OR Apache-2.0 | Copyright (c) 2014 Alex Crichton |
| [chrono](https://github.com/chronotope/chrono) | 0.4.45 | MIT OR Apache-2.0 | Copyright (c) 2014, Kang Seonghoon. |
| [cookie](https://github.com/SergioBenitez/cookie-rs) | 0.18.2 | MIT OR Apache-2.0 | Copyright (c) 2017 Sergio Benitez |
| [core-foundation](https://github.com/servo/core-foundation-rs) | 0.10.1 | MIT OR Apache-2.0 | Copyright (c) 2012-2013 Mozilla Foundation |
| [core-foundation-sys](https://github.com/servo/core-foundation-rs) | 0.8.7 | MIT OR Apache-2.0 | Copyright (c) 2012-2013 Mozilla Foundation |
| [core-graphics](https://github.com/servo/core-foundation-rs) | 0.25.0 | MIT OR Apache-2.0 | Copyright (c) 2012-2013 Mozilla Foundation |
| [core-graphics-types](https://github.com/servo/core-foundation-rs) | 0.2.0 | MIT OR Apache-2.0 | Copyright (c) 2012-2013 Mozilla Foundation |
| [cpufeatures](https://github.com/RustCrypto/utils) | 0.2.17 | MIT OR Apache-2.0 | Copyright (c) 2020-2025 The RustCrypto Project Developers |
| [crc32fast](https://github.com/srijs/rust-crc32fast) | 1.5.1 | MIT OR Apache-2.0 | Copyright (c) 2018 Sam Rijs, Alex Crichton and contributors |
| [crossbeam-channel](https://github.com/crossbeam-rs/crossbeam) | 0.5.16 | MIT OR Apache-2.0 | Copyright (c) 2019 The Crossbeam Project Developers |
| [crossbeam-utils](https://github.com/crossbeam-rs/crossbeam) | 0.8.22 | MIT OR Apache-2.0 | Copyright (c) 2019 The Crossbeam Project Developers |
| [crypto-common](https://github.com/RustCrypto/traits) | 0.1.7 | MIT OR Apache-2.0 | Copyright (c) 2021 RustCrypto Developers |
| [cssparser](https://github.com/servo/rust-cssparser) | 0.36.0 | MPL-2.0 | — |
| [cssparser-macros](https://github.com/servo/rust-cssparser) | 0.6.1 | MPL-2.0 | — |
| [ctor](https://github.com/mmastrac/rust-ctor) | 0.8.0 | Apache-2.0 OR MIT | copyright notice that is included in or attached to the work |
| [ctor-proc-macro](https://github.com/mmastrac/rust-ctor) | 0.0.7 | Apache-2.0 OR MIT | copyright notice that is included in or attached to the work |
| [darling](https://github.com/TedDriggs/darling) | 0.23.0 | MIT | Copyright (c) 2017 Ted Driggs |
| [darling_core](https://github.com/TedDriggs/darling) | 0.23.0 | MIT | Copyright (c) 2017 Ted Driggs |
| [darling_macro](https://github.com/TedDriggs/darling) | 0.23.0 | MIT | Copyright (c) 2017 Ted Driggs |
| [defmt](https://github.com/knurling-rs/defmt) | 1.1.1 | MIT OR Apache-2.0 | Copyright (c) Ferrous Systems |
| [defmt-macros](https://github.com/knurling-rs/defmt) | 1.1.1 | MIT OR Apache-2.0 | Copyright (c) Ferrous Systems |
| [defmt-parser](https://github.com/knurling-rs/defmt) | 1.0.0 | MIT OR Apache-2.0 | — |
| [deranged](https://github.com/jhpratt/deranged) | 0.5.8 | MIT OR Apache-2.0 | Copyright (c) 2024 Jacob Pratt et al. |
| [derive_more](https://github.com/JelteF/derive_more) | 2.1.1 | MIT | Copyright (c) 2016 Jelte Fennema |
| [derive_more-impl](https://github.com/JelteF/derive_more) | 2.1.1 | MIT | Copyright (c) 2016 Jelte Fennema |
| [digest](https://github.com/RustCrypto/traits) | 0.10.7 | MIT OR Apache-2.0 | Copyright (c) 2017 Artyom Pavlov |
| [dirs](https://github.com/soc/dirs-rs) | 6.0.0 | MIT OR Apache-2.0 | Copyright (c) 2018-2019 dirs-rs contributors |
| [dirs-sys](https://github.com/dirs-dev/dirs-sys-rs) | 0.5.0 | MIT OR Apache-2.0 | Copyright (c) 2018-2019 dirs-rs contributors |
| [dispatch2](https://github.com/madsmtm/objc2) | 0.3.1 | Zlib OR Apache-2.0 OR MIT | — |
| [displaydoc](https://github.com/yaahc/displaydoc) | 0.2.7 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [dom_query](https://github.com/niklak/dom_query) | 0.27.0 | MIT | Copyright (c) 2023 Mykola Humanov |
| [dpi](https://github.com/rust-windowing/winit) | 0.1.2 | Apache-2.0 AND MIT | Copyright (c) 2018 Jorge Aparicio |
| [dtoa](https://github.com/dtolnay/dtoa) | 1.0.11 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [dtoa-short](https://github.com/upsuper/dtoa-short) | 0.3.5 | MPL-2.0 | — |
| [dtor](https://github.com/mmastrac/rust-ctor) | 0.3.0 | Apache-2.0 OR MIT | copyright notice that is included in or attached to the work |
| [dtor-proc-macro](https://github.com/mmastrac/rust-ctor) | 0.0.6 | Apache-2.0 OR MIT | copyright notice that is included in or attached to the work |
| [dunce](https://gitlab.com/kornelski/dunce) | 1.0.5 | CC0-1.0 OR MIT-0 OR Apache-2.0 | — |
| [dyn-clone](https://github.com/dtolnay/dyn-clone) | 1.0.20 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [embed_plist](https://github.com/nvzqz/embed-plist-rs) | 1.2.2 | MIT OR Apache-2.0 | Copyright (c) 2020 Nikolai Vazquez |
| [equivalent](https://github.com/indexmap-rs/equivalent) | 1.0.2 | Apache-2.0 OR MIT | Copyright (c) 2016--2023 |
| [erased-serde](https://github.com/dtolnay/erased-serde) | 0.4.10 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [fastrand](https://github.com/smol-rs/fastrand) | 2.5.0 | Apache-2.0 OR MIT | copyright notice that is included in or attached to the work |
| [fdeflate](https://github.com/image-rs/fdeflate) | 0.3.7 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [flate2](https://github.com/rust-lang/flate2-rs) | 1.1.10 | MIT OR Apache-2.0 | Copyright (c) 2014-2026 Alex Crichton |
| [fnv](https://github.com/servo/rust-fnv) | 1.0.7 | Apache-2.0 / MIT | Copyright (c) 2017 Contributors |
| [foldhash](https://github.com/orlp/foldhash) | 0.2.0 | Zlib | Copyright (c) 2024 Orson Peters |
| [foreign-types](https://github.com/sfackler/foreign-types) | 0.5.0 | MIT/Apache-2.0 | Copyright (c) 2017 The foreign-types Developers |
| [foreign-types-macros](https://github.com/sfackler/foreign-types) | 0.2.4 | MIT/Apache-2.0 | Copyright (c) 2017 The foreign-types Developers |
| [foreign-types-shared](https://github.com/sfackler/foreign-types) | 0.3.1 | MIT/Apache-2.0 | Copyright (c) 2017 The foreign-types Developers |
| [form_urlencoded](https://github.com/servo/rust-url) | 1.2.2 | MIT OR Apache-2.0 | Copyright (c) 2013-2016 The rust-url developers |
| [generic-array](https://github.com/fizyk20/generic-array.git) | 0.14.7 | MIT | Copyright (c) 2015 Bartłomiej Kamiński |
| [getrandom](https://github.com/rust-random/getrandom) | 0.4.3 | MIT OR Apache-2.0 | Copyright (c) 2018-2026 The rust-random Project Developers |
| [getrandom](https://github.com/rust-random/getrandom) | 0.3.4 | MIT OR Apache-2.0 | Copyright (c) 2018-2025 The rust-random Project Developers |
| [glob](https://github.com/rust-lang/glob) | 0.3.4 | MIT OR Apache-2.0 | Copyright (c) 2014 The Rust Project Developers |
| [hashbrown](https://github.com/rust-lang/hashbrown) | 0.17.1 | MIT OR Apache-2.0 | Copyright (c) 2016 Amanieu d'Antras |
| [hashbrown](https://github.com/rust-lang/hashbrown) | 0.12.3 | MIT OR Apache-2.0 | Copyright (c) 2016 Amanieu d'Antras |
| [heck](https://github.com/withoutboats/heck) | 0.5.0 | MIT OR Apache-2.0 | Copyright (c) 2015 The Rust Project Developers |
| [hex](https://github.com/KokaKiwi/rust-hex) | 0.4.3 | MIT OR Apache-2.0 | Copyright (c) 2013-2014 The Rust Project Developers. |
| [html5ever](https://github.com/servo/html5ever) | 0.38.0 | MIT OR Apache-2.0 | Copyright (c) 2014 The html5ever Project Developers |
| [http](https://github.com/hyperium/http) | 1.5.0 | MIT OR Apache-2.0 | Copyright (c) 2017 http-rs authors |
| [iana-time-zone](https://github.com/strawlab/iana-time-zone) | 0.1.65 | MIT OR Apache-2.0 | Copyright (c) 2020 Andrew D. Straw |
| [ico](https://github.com/mdsteele/rust-ico) | 0.5.0 | MIT | Copyright (c) 2018 Matthew D. Steele |
| [icu_collections](https://github.com/unicode-org/icu4x) | 2.3.0 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [icu_locale_core](https://github.com/unicode-org/icu4x) | 2.3.0 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [icu_normalizer](https://github.com/unicode-org/icu4x) | 2.3.0 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [icu_normalizer_data](https://github.com/unicode-org/icu4x) | 2.3.0 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [icu_properties](https://github.com/unicode-org/icu4x) | 2.3.0 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [icu_properties_data](https://github.com/unicode-org/icu4x) | 2.3.0 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [icu_provider](https://github.com/unicode-org/icu4x) | 2.3.1 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [ident_case](https://github.com/TedDriggs/ident_case) | 1.0.1 | MIT/Apache-2.0 | — |
| [idna](https://github.com/servo/rust-url/) | 1.1.0 | MIT OR Apache-2.0 | Copyright (c) 2013-2025 The rust-url developers |
| [idna_adapter](https://github.com/hsivonen/idna_adapter) | 1.2.2 | Apache-2.0 OR MIT | Copyright (c) The rust-url developers |
| [indexmap](https://github.com/indexmap-rs/indexmap) | 2.14.1 | Apache-2.0 OR MIT | Copyright (c) 2016--2017 |
| [indexmap](https://github.com/bluss/indexmap) | 1.9.3 | Apache-2.0 OR MIT | Copyright (c) 2016--2017 |
| [infer](https://github.com/bojand/infer) | 0.19.0 | MIT | Copyright (c) 2019 Bojan |
| [itoa](https://github.com/dtolnay/itoa) | 1.0.18 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [jiff](https://github.com/BurntSushi/jiff) | 0.2.35 | Unlicense OR MIT | Copyright (c) 2015 Andrew Gallant |
| [jiff-core](https://github.com/BurntSushi/jiff) | 0.1.0 | Unlicense OR MIT | Copyright (c) 2015 Andrew Gallant |
| [json-patch](https://github.com/idubrov/json-patch) | 3.0.1 | MIT/Apache-2.0 | Copyright (c) 2017 Ivan Dubrov |
| [jsonptr](https://github.com/chanced/jsonptr) | 0.6.3 | MIT OR Apache-2.0 | Copyright (c) 2022 Chance Dinkins |
| [keyboard-types](https://github.com/pyfisch/keyboard-types) | 0.7.0 | MIT OR Apache-2.0 | Copyright (c) 2017 Pyfisch |
| [libc](https://github.com/rust-lang/libc) | 0.2.189 | MIT OR Apache-2.0 | Copyright (c) The Rust Project Developers |
| [litemap](https://github.com/unicode-org/icu4x) | 0.8.3 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [lock_api](https://github.com/Amanieu/parking_lot) | 0.4.14 | MIT OR Apache-2.0 | Copyright (c) 2016 The Rust Project Developers |
| [log](https://github.com/rust-lang/log) | 0.4.34 | MIT OR Apache-2.0 | Copyright (c) 2014 The Rust Project Developers |
| [markup5ever](https://github.com/servo/html5ever) | 0.38.0 | MIT OR Apache-2.0 | Copyright (c) 2014 The html5ever Project Developers |
| [memchr](https://github.com/BurntSushi/memchr) | 2.8.3 | Unlicense OR MIT | Copyright (c) 2015 Andrew Gallant |
| [mime](https://github.com/hyperium/mime) | 0.3.17 | MIT OR Apache-2.0 | Copyright (c) 2014 Sean McArthur |
| [miniz_oxide](https://github.com/Frommi/miniz_oxide/tree/master/miniz_oxide) | 0.8.9 | MIT OR Zlib OR Apache-2.0 | Copyright 2013-2014 RAD Game Tools and Valve Software |
| [miniz_oxide](https://github.com/Frommi/miniz_oxide/tree/master/miniz_oxide) | 0.9.1 | MIT OR Zlib OR Apache-2.0 | Copyright 2013-2014 RAD Game Tools and Valve Software |
| [mio](https://github.com/tokio-rs/mio) | 1.2.2 | MIT | Copyright (c) 2014 Carl Lerche and other MIO contributors |
| [muda](https://github.com/tauri-apps/muda) | 0.19.3 | Apache-2.0 OR MIT | Copyright (c) 2022-2022 Tauri Programme within The Commons Conservancy |
| [new_debug_unreachable](https://github.com/mbrubeck/rust-debug-unreachable) | 1.0.6 | MIT | Copyright (c) 2015 Jonathan Reem |
| [num-conv](https://github.com/jhpratt/num-conv) | 0.2.2 | MIT OR Apache-2.0 | Copyright (c) Jacob Pratt |
| [num-traits](https://github.com/rust-num/num-traits) | 0.2.19 | MIT OR Apache-2.0 | Copyright (c) 2014 The Rust Project Developers |
| [objc2](https://github.com/madsmtm/objc2) | 0.6.4 | MIT | — |
| [objc2-app-kit](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-cloud-kit](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-core-data](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-core-foundation](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-core-graphics](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-core-image](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-core-text](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-core-video](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-encode](https://github.com/madsmtm/objc2) | 4.1.0 | MIT | — |
| [objc2-exception-helper](https://github.com/madsmtm/objc2) | 0.1.1 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-foundation](https://github.com/madsmtm/objc2) | 0.3.2 | MIT | — |
| [objc2-io-surface](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-quartz-core](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [objc2-web-kit](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | — |
| [once_cell](https://github.com/matklad/once_cell) | 1.21.4 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [option-ext](https://github.com/soc/option-ext.git) | 0.2.0 | MPL-2.0 | — |
| [parking_lot](https://github.com/Amanieu/parking_lot) | 0.12.5 | MIT OR Apache-2.0 | Copyright (c) 2016 The Rust Project Developers |
| [parking_lot_core](https://github.com/Amanieu/parking_lot) | 0.9.12 | MIT OR Apache-2.0 | Copyright (c) 2016 The Rust Project Developers |
| [percent-encoding](https://github.com/servo/rust-url/) | 2.3.2 | MIT OR Apache-2.0 | Copyright (c) 2013-2025 The rust-url developers |
| [phf](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi |
| [phf_generator](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi |
| [phf_macros](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi |
| [phf_shared](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi |
| [pin-project-lite](https://github.com/taiki-e/pin-project-lite) | 0.2.17 | Apache-2.0 OR MIT | copyright notice that is included in or attached to the work |
| [plist](https://github.com/ebarnard/rust-plist/) | 1.10.0 | MIT | Copyright (c) 2015 Edward Barnard |
| [png](https://github.com/image-rs/image-png) | 0.18.1 | MIT OR Apache-2.0 | Copyright (c) 2015 nwin |
| [png](https://github.com/image-rs/image-png) | 0.17.16 | MIT OR Apache-2.0 | Copyright (c) 2015 nwin |
| [potential_utf](https://github.com/unicode-org/icu4x) | 0.1.6 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [powerfmt](https://github.com/jhpratt/powerfmt) | 0.2.0 | MIT OR Apache-2.0 | Copyright (c) 2023 Jacob Pratt et al. |
| [precomputed-hash](https://github.com/emilio/precomputed-hash) | 0.1.1 | MIT | Copyright (c) 2017 Emilio Cobos Álvarez |
| [proc-macro2](https://github.com/dtolnay/proc-macro2) | 1.0.107 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [quick-xml](https://github.com/tafia/quick-xml) | 0.41.0 | MIT | Copyright (c) 2016 Johann Tuffe |
| [quote](https://github.com/dtolnay/quote) | 1.0.47 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [raw-window-handle](https://github.com/rust-windowing/raw-window-handle) | 0.6.2 | MIT OR Apache-2.0 OR Zlib | Copyright (c) 2019 Osspial |
| [ref-cast](https://github.com/dtolnay/ref-cast) | 1.0.27 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [ref-cast-impl](https://github.com/dtolnay/ref-cast) | 1.0.27 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [regex](https://github.com/rust-lang/regex) | 1.13.1 | MIT OR Apache-2.0 | Copyright (c) 2014 The Rust Project Developers |
| [regex-automata](https://github.com/rust-lang/regex) | 0.4.18 | MIT OR Apache-2.0 | Copyright (c) 2014 The Rust Project Developers |
| [regex-syntax](https://github.com/rust-lang/regex) | 0.8.11 | MIT OR Apache-2.0 | Copyright (c) 2014 The Rust Project Developers |
| [rfd](https://github.com/PolyMeilex/rfd) | 0.16.0 | MIT | Copyright (c) 2022 Bartłomiej Maryńczak |
| [rustc-hash](https://github.com/rust-lang/rustc-hash) | 2.1.3 | Apache-2.0 OR MIT | copyright notice that is included in or attached to the work |
| [same-file](https://github.com/BurntSushi/same-file) | 1.0.6 | Unlicense/MIT | Copyright (c) 2017 Andrew Gallant |
| [schemars](https://github.com/GREsau/schemars) | 1.2.2 | MIT | Copyright (c) 2019 Graham Esau |
| [schemars](https://github.com/GREsau/schemars) | 0.9.0 | MIT | Copyright (c) 2019 Graham Esau |
| [schemars](https://github.com/GREsau/schemars) | 0.8.22 | MIT | Copyright (c) 2019 Graham Esau |
| [schemars_derive](https://github.com/GREsau/schemars) | 0.8.22 | MIT | Copyright (c) 2019 Graham Esau |
| [scopeguard](https://github.com/bluss/scopeguard) | 1.2.0 | MIT OR Apache-2.0 | Copyright (c) 2016-2019 Ulrik Sverdrup "bluss" and scopeguard developers |
| [selectors](https://github.com/servo/stylo) | 0.36.1 | MPL-2.0 | — |
| [semver](https://github.com/dtolnay/semver) | 1.0.28 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [serde](https://github.com/serde-rs/serde) | 1.0.229 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [serde_core](https://github.com/serde-rs/serde) | 1.0.229 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [serde_derive](https://github.com/serde-rs/serde) | 1.0.229 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [serde_derive_internals](https://github.com/serde-rs/serde) | 0.29.1 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [serde_json](https://github.com/serde-rs/json) | 1.0.151 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [serde_repr](https://github.com/dtolnay/serde-repr) | 0.1.21 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [serde_spanned](https://github.com/toml-rs/toml) | 1.1.1 | MIT OR Apache-2.0 | Copyright (c) Individual contributors |
| [serde_with](https://github.com/jonasbb/serde_with/) | 3.22.0 | MIT OR Apache-2.0 | Copyright (c) 2015 |
| [serde_with_macros](https://github.com/jonasbb/serde_with/) | 3.22.0 | MIT OR Apache-2.0 | Copyright (c) 2015 |
| [serde-untagged](https://github.com/dtolnay/serde-untagged) | 0.1.9 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [serialize-to-javascript](https://github.com/chippers/serialize-to-javascript) | 0.1.2 | MIT OR Apache-2.0 | Copyright (c) 2021 Chip Reed |
| [serialize-to-javascript-impl](https://github.com/chippers/serialize-to-javascript) | 0.1.2 | MIT OR Apache-2.0 | Copyright (c) 2021 Chip Reed |
| [servo_arc](https://github.com/servo/stylo) | 0.4.3 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [sha2](https://github.com/RustCrypto/hashes) | 0.10.9 | MIT OR Apache-2.0 | Copyright (c) 2006-2009 Graydon Hoare |
| [simd-adler32](https://github.com/mcountryman/simd-adler32) | 0.3.10 | MIT | Copyright (c) [2021] [Marvin Countryman] |
| [siphasher](https://github.com/jedisct1/rust-siphash) | 1.0.3 | MIT/Apache-2.0 | Copyright 2012-2016 The Rust Project Developers. |
| [smallvec](https://github.com/servo/rust-smallvec) | 1.15.2 | MIT OR Apache-2.0 | Copyright (c) 2018 The Servo Project Developers |
| [socket2](https://github.com/rust-lang/socket2) | 0.6.5 | MIT OR Apache-2.0 | Copyright (c) 2014 Alex Crichton |
| [stable_deref_trait](https://github.com/storyyeller/stable_deref_trait) | 1.2.1 | MIT OR Apache-2.0 | Copyright (c) 2017 Robert Grosse |
| [string_cache](https://github.com/servo/string-cache) | 0.9.0 | MIT OR Apache-2.0 | Copyright (c) 2012-2013 Mozilla Foundation |
| [strsim](https://github.com/rapidfuzz/strsim-rs) | 0.11.1 | MIT | Copyright (c) 2015 Danny Guo |
| [swift-rs](https://github.com/Brendonovich/swift-rs) | 1.0.8 | MIT OR Apache-2.0 | Copyright (c) 2023 The swift-rs Developers |
| [syn](https://github.com/dtolnay/syn) | 3.0.4 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [syn](https://github.com/dtolnay/syn) | 2.0.119 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [synstructure](https://github.com/mystor/synstructure) | 0.13.2 | MIT | Copyright 2016 Nika Layzell |
| [tao](https://github.com/tauri-apps/tao) | 0.35.3 | Apache-2.0 | copyright notice that is included in or attached to the work |
| [tauri](https://github.com/tauri-apps/tauri) | 2.11.5 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [tauri-codegen](https://github.com/tauri-apps/tauri) | 2.6.3 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [tauri-macros](https://github.com/tauri-apps/tauri) | 2.6.3 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [tauri-plugin-dialog](https://github.com/tauri-apps/plugins-workspace) | 2.7.2 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [tauri-plugin-fs](https://github.com/tauri-apps/plugins-workspace) | 2.5.1 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [tauri-runtime](https://github.com/tauri-apps/tauri) | 2.11.3 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [tauri-runtime-wry](https://github.com/tauri-apps/tauri) | 2.11.4 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [tauri-utils](https://github.com/tauri-apps/tauri) | 2.9.3 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [tendril](https://github.com/servo/html5ever) | 0.5.1 | MIT OR Apache-2.0 | Copyright (c) 2015 Keegan McAllister |
| [thiserror](https://github.com/dtolnay/thiserror) | 2.0.20 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [thiserror](https://github.com/dtolnay/thiserror) | 1.0.69 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [thiserror-impl](https://github.com/dtolnay/thiserror) | 2.0.20 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [thiserror-impl](https://github.com/dtolnay/thiserror) | 1.0.69 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [time](https://github.com/time-rs/time) | 0.3.55 | MIT OR Apache-2.0 | Copyright (c) Jacob Pratt et al. |
| [time-core](https://github.com/time-rs/time) | 0.1.9 | MIT OR Apache-2.0 | Copyright (c) Jacob Pratt et al. |
| [time-macros](https://github.com/time-rs/time) | 0.2.32 | MIT OR Apache-2.0 | Copyright (c) Jacob Pratt et al. |
| [tinystr](https://github.com/unicode-org/icu4x) | 0.8.4 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [tinyvec](https://github.com/Lokathor/tinyvec) | 1.12.0 | Zlib OR Apache-2.0 OR MIT | Copyright (c) 2019 Daniel "Lokathor" Gee. |
| [tinyvec_macros](https://github.com/Soveu/tinyvec_macros) | 0.1.1 | MIT OR Apache-2.0 OR Zlib | Copyright (c) 2020 Soveu |
| [tokio](https://github.com/tokio-rs/tokio) | 1.53.1 | MIT | Copyright (c) Tokio Contributors |
| [toml](https://github.com/toml-rs/toml) | 1.1.4+spec-1.1.0 | MIT OR Apache-2.0 | Copyright (c) Individual contributors |
| [toml_datetime](https://github.com/toml-rs/toml) | 1.1.1+spec-1.1.0 | MIT OR Apache-2.0 | Copyright (c) Individual contributors |
| [toml_parser](https://github.com/toml-rs/toml) | 1.1.3+spec-1.1.0 | MIT OR Apache-2.0 | Copyright (c) Individual contributors |
| [toml_writer](https://github.com/toml-rs/toml) | 1.1.2+spec-1.1.0 | MIT OR Apache-2.0 | Copyright (c) Individual contributors |
| [tray-icon](https://github.com/tauri-apps/tray-icon) | 0.24.2 | MIT OR Apache-2.0 | Copyright (c) 2022-2022 Tauri Programme within The Commons Conservancy |
| [typeid](https://github.com/dtolnay/typeid) | 1.0.3 | MIT OR Apache-2.0 | copyright notice that is included in or attached to the work |
| [typenum](https://github.com/paholg/typenum) | 1.20.1 | MIT OR Apache-2.0 | Copyright (c) 2014 Paho Lurie-Gregg |
| [unic-char-property](https://github.com/open-i18n/rust-unic/) | 0.9.0 | MIT/Apache-2.0 | — |
| [unic-char-range](https://github.com/open-i18n/rust-unic/) | 0.9.0 | MIT/Apache-2.0 | — |
| [unic-common](https://github.com/open-i18n/rust-unic/) | 0.9.0 | MIT/Apache-2.0 | — |
| [unic-ucd-ident](https://github.com/open-i18n/rust-unic/) | 0.9.0 | MIT/Apache-2.0 | — |
| [unic-ucd-version](https://github.com/open-i18n/rust-unic/) | 0.9.0 | MIT/Apache-2.0 | — |
| [unicode-ident](https://github.com/dtolnay/unicode-ident) | 1.0.24 | (MIT OR Apache-2.0) AND Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [unicode-segmentation](https://github.com/unicode-rs/unicode-segmentation) | 1.13.3 | MIT OR Apache-2.0 | Copyright (c) 2015 The Rust Project Developers |
| [url](https://github.com/servo/rust-url) | 2.5.8 | MIT OR Apache-2.0 | Copyright (c) 2013-2025 The rust-url developers |
| [urlpattern](https://github.com/denoland/rust-urlpattern) | 0.3.0 | MIT | Copyright (c) 2021 the Deno authors |
| [utf8_iter](https://github.com/hsivonen/utf8_iter) | 1.0.4 | Apache-2.0 OR MIT | Copyright Mozilla Foundation |
| [uuid](https://github.com/uuid-rs/uuid) | 1.26.0 | Apache-2.0 OR MIT | Copyright (c) 2014 The Rust Project Developers |
| [walkdir](https://github.com/BurntSushi/walkdir) | 2.5.0 | Unlicense/MIT | Copyright (c) 2015 Andrew Gallant |
| [web_atoms](https://github.com/servo/html5ever) | 0.2.6 | MIT OR Apache-2.0 | Copyright (c) 2014 The html5ever Project Developers |
| [window-vibrancy](https://github.com/tauri-apps/tauri-plugin-vibrancy) | 0.6.0 | Apache-2.0 OR MIT | Copyright (c) 2020-2022 Tauri Programme within The Commons Conservancy |
| [winnow](https://github.com/winnow-rs/winnow) | 1.0.4 | MIT | — |
| [writeable](https://github.com/unicode-org/icu4x) | 0.6.4 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [wry](https://github.com/tauri-apps/wry) | 0.55.1 | Apache-2.0 OR MIT | Copyright (c) 2020-2023 Ngo Iok Ui & Tauri Programme within The Commons Conservancy |
| [yoke](https://github.com/unicode-org/icu4x) | 0.8.3 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [yoke-derive](https://github.com/unicode-org/icu4x) | 0.8.2 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [zerofrom](https://github.com/unicode-org/icu4x) | 0.1.8 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [zerofrom-derive](https://github.com/unicode-org/icu4x) | 0.1.7 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [zerotrie](https://github.com/unicode-org/icu4x) | 0.2.5 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [zerovec](https://github.com/unicode-org/icu4x) | 0.11.8 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [zerovec-derive](https://github.com/unicode-org/icu4x) | 0.11.6 | Unicode-3.0 | COPYRIGHT AND PERMISSION NOTICE |
| [zlib-rs](https://github.com/trifectatechfoundation/zlib-rs) | 0.6.7 | Zlib | — |
| [zmij](https://github.com/dtolnay/zmij) | 1.0.23 | MIT | — |

## npm パッケージ (9)

フロントエンドのバンドルに含まれるパッケージです。

| パッケージ | バージョン | ライセンス | 著作権表示 |
| --- | --- | --- | --- |
| [@tauri-apps/api](https://github.com/tauri-apps/tauri) | 2.11.1 | Apache-2.0 OR MIT | Copyright (c) 2017 - Present Tauri Apps Contributors |
| [@tauri-apps/plugin-dialog](https://github.com/tauri-apps/plugins-workspace) | 2.7.2 | MIT OR Apache-2.0 | — |
| [@tauri-apps/plugin-fs](https://github.com/tauri-apps/plugins-workspace) | 2.5.1 | MIT OR Apache-2.0 | — |
| [@types/react](https://github.com/DefinitelyTyped/DefinitelyTyped) | 19.2.18 | MIT | Copyright (c) Microsoft Corporation. |
| [csstype](https://github.com/frenic/csstype) | 3.2.3 | MIT | Copyright (c) 2017-2018 Fredrik Nicol |
| [react](https://github.com/react/react) | 19.2.8 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [react-dom](https://github.com/react/react) | 19.2.8 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [scheduler](https://github.com/facebook/react) | 0.27.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [zustand](https://github.com/pmndrs/zustand) | 5.0.15 | MIT | Copyright (c) 2019 Paul Henschel |

## ライセンス全文について

各ライセンスの全文は、それぞれのパッケージに同梱されています。

- Rust クレート: `~/.cargo/registry/src/*/<crate>-<version>/LICENSE*`
- npm パッケージ: `node_modules/<package>/LICENSE*`

主要なライセンスの全文は以下で参照できます。

- [MIT License](https://opensource.org/licenses/MIT)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [ISC License](https://opensource.org/licenses/ISC)
- [BSD 2-Clause](https://opensource.org/licenses/BSD-2-Clause) / [BSD 3-Clause](https://opensource.org/licenses/BSD-3-Clause)
- [Blue Oak Model License 1.0.0](https://blueoakcouncil.org/license/1.0.0)
- [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- [Unicode License](https://www.unicode.org/license.txt)

## 商標について

Tauri および Tauri のロゴは Tauri プロジェクトの商標です。MatoMemo は Tauri を
利用していますが、Tauri プロジェクトによって承認・提携されたものではありません。
アプリケーションアイコンは MatoMemo 独自のものです（`assets/app-icon.svg`）。
