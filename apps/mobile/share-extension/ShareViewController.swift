import UIKit

private final class PaddedLabel: UILabel {
  var inset = UIEdgeInsets(top: 11, left: 12, bottom: 11, right: 12)
  override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: inset)) }
  override var intrinsicContentSize: CGSize {
    let value = super.intrinsicContentSize
    return CGSize(width: value.width + inset.left + inset.right, height: value.height + inset.top + inset.bottom)
  }
}

final class ShareViewController: UIViewController, UITextViewDelegate {
  private let ink = UIColor(red: 0.09, green: 0.098, blue: 0.09, alpha: 1)
  private let paper = UIColor(red: 0.953, green: 0.953, blue: 0.941, alpha: 1)
  private let muted = UIColor(red: 0.408, green: 0.439, blue: 0.392, alpha: 1)
  private let accent = UIColor(red: 0.776, green: 0.231, blue: 0.137, alpha: 1)
  private let titleLabel = UILabel()
  private let statusLabel = UILabel()
  private let itemStack = UIStackView()
  private let noteView = UITextView()
  private let saveButton = UIButton(type: .system)
  private let cancelButton = UIButton(type: .system)
  private let openButton = UIButton(type: .system)
  private var items: [FoundkeepShareItem] = []
  private var loader: ShareItemLoader?
  private var uploader: ShareUploader?

  override func viewDidLoad() {
    super.viewDidLoad()
    buildInterface()
    Task { await loadItems() }
  }

  private func buildInterface() {
    preferredContentSize = CGSize(width: 0, height: 620)
    view.backgroundColor = paper
    cancelButton.setTitle("Cancel", for: .normal); cancelButton.tintColor = ink; cancelButton.addTarget(self, action: #selector(cancelShare), for: .touchUpInside)
    saveButton.setTitle("Save", for: .normal); saveButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold); saveButton.tintColor = accent; saveButton.isEnabled = false; saveButton.addTarget(self, action: #selector(saveShare), for: .touchUpInside)
    let navigation = UIStackView(arrangedSubviews: [cancelButton, UIView(), saveButton]); navigation.axis = .horizontal; navigation.alignment = .center
    let mark = UIView(); mark.backgroundColor = ink; mark.layer.cornerRadius = 9; mark.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([mark.widthAnchor.constraint(equalToConstant: 40), mark.heightAnchor.constraint(equalToConstant: 40)])
    let dot = UIView(); dot.backgroundColor = accent; dot.layer.cornerRadius = 4; dot.translatesAutoresizingMaskIntoConstraints = false; mark.addSubview(dot)
    NSLayoutConstraint.activate([dot.widthAnchor.constraint(equalToConstant: 8), dot.heightAnchor.constraint(equalToConstant: 8), dot.trailingAnchor.constraint(equalTo: mark.trailingAnchor, constant: -9), dot.bottomAnchor.constraint(equalTo: mark.bottomAnchor, constant: -8)])
    titleLabel.text = "Save to Foundkeep"; titleLabel.font = .systemFont(ofSize: 25, weight: .bold); titleLabel.textColor = ink
    let brand = UIStackView(arrangedSubviews: [mark, titleLabel]); brand.axis = .horizontal; brand.spacing = 12; brand.alignment = .center
    statusLabel.text = "Reading what you shared…"; statusLabel.font = .systemFont(ofSize: 13); statusLabel.textColor = muted; statusLabel.numberOfLines = 0
    itemStack.axis = .vertical; itemStack.spacing = 8
    noteView.backgroundColor = UIColor.white.withAlphaComponent(0.72); noteView.layer.borderWidth = 1; noteView.layer.borderColor = UIColor(red: 0.78, green: 0.80, blue: 0.76, alpha: 1).cgColor; noteView.layer.cornerRadius = 10; noteView.font = .systemFont(ofSize: 16); noteView.text = "Add a note…"; noteView.textColor = muted; noteView.delegate = self; noteView.translatesAutoresizingMaskIntoConstraints = false; noteView.heightAnchor.constraint(equalToConstant: 92).isActive = true; noteView.textContainerInset = UIEdgeInsets(top: 12, left: 9, bottom: 12, right: 9)
    openButton.setTitle("Open Foundkeep to connect", for: .normal); openButton.isHidden = true; openButton.addTarget(self, action: #selector(openFoundkeep), for: .touchUpInside)
    openButton.tintColor = accent
    let stack = UIStackView(arrangedSubviews: [navigation, brand, statusLabel, itemStack, noteView, openButton]); stack.axis = .vertical; stack.spacing = 16; stack.translatesAutoresizingMaskIntoConstraints = false
    let scroll = UIScrollView(); scroll.alwaysBounceVertical = true; scroll.keyboardDismissMode = .interactive; scroll.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(scroll); scroll.addSubview(stack)
    NSLayoutConstraint.activate([
      scroll.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor), scroll.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
      scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), scroll.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
      stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor, constant: 20), stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor, constant: -20),
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 12), stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -20),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -40),
    ])
  }

  private func loadItems() async {
    do {
      let loader = try ShareItemLoader(); let uploader = try ShareUploader(); self.loader = loader; self.uploader = uploader
      let input = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
      items = try await loader.load(input)
      await MainActor.run {
        itemStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for item in items.prefix(6) {
          let row = PaddedLabel(); row.font = .systemFont(ofSize: 14, weight: .semibold); row.textColor = self.ink; row.numberOfLines = 2
          row.text = "\(symbol(item.type))  \(item.sourceTitle ?? item.fileName ?? item.selectionText?.prefix(70).description ?? item.type.capitalized)"
          row.backgroundColor = UIColor.white.withAlphaComponent(0.65); row.layer.cornerRadius = 8; row.layer.masksToBounds = true; itemStack.addArrangedSubview(row)
        }
        if items.count > 6 { let more = UILabel(); more.text = "+ \(items.count - 6) more items"; more.font = .systemFont(ofSize: 13); more.textColor = self.muted; itemStack.addArrangedSubview(more) }
        if uploader.isConnected { statusLabel.text = FoundkeepSharePolicy.current.notice ?? (items.count == 1 ? "One item ready. Its source will stay attached." : "\(items.count) items ready. They will stay together in your collection."); saveButton.isEnabled = true }
        else { statusLabel.text = "Open Foundkeep once to connect this iPhone, then share again."; openButton.isHidden = false }
      }
    } catch { await MainActor.run { statusLabel.text = error.localizedDescription; openButton.isHidden = false } }
  }

  @objc private func saveShare() {
    guard let uploader else { return }
    saveButton.isEnabled = false; cancelButton.isEnabled = false; statusLabel.text = "Saving safely…"
    let note = noteView.textColor == muted ? "" : noteView.text
    Task {
      do {
        let result = try await uploader.save(items, note: note ?? "")
        await MainActor.run { statusLabel.text = result.queued == 0 ? "Saved to your collection." : "Saved safely. \(result.queued) will upload when Foundkeep is online." }
        try? await Task.sleep(nanoseconds: 450_000_000); extensionContext?.completeRequest(returningItems: nil)
      } catch { await MainActor.run { statusLabel.text = error.localizedDescription; saveButton.isEnabled = true; cancelButton.isEnabled = true } }
    }
  }

  @objc private func cancelShare() { loader?.discard(items); extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError)) }
  @objc private func openFoundkeep() { guard let url = URL(string: "foundkeep://") else { return }; extensionContext?.open(url) { opened in if opened { self.extensionContext?.completeRequest(returningItems: nil) } else { self.statusLabel.text = "Open the Foundkeep app from your Home Screen, then return here." } } }
  func textViewDidBeginEditing(_ textView: UITextView) { if textView.textColor == muted { textView.text = ""; textView.textColor = ink } }
  func textViewDidEndEditing(_ textView: UITextView) { if textView.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { textView.text = "Add a note…"; textView.textColor = muted } }
  private func symbol(_ type: String) -> String { ["bookmark": "↗", "selection": "“", "image": "▧", "video": "▶", "audio": "♪", "document": "▤", "file": "□"][type] ?? "•" }
}
