document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "https://localhost:7072/api/Point";
    const INITIAL_COORDINATES = [35.2433, 39.0668];
    const INITIAL_ZOOM = 6;
  
    const resetViewBtn = document.getElementById("resetViewBtn");
    const queryBtn = document.getElementById("queryBtn");
    const geometryBtn = document.getElementById("geometryBtn");
  
    const map = new ol.Map({
      target: "map",
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM(),
        }),
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat(INITIAL_COORDINATES),
        zoom: INITIAL_ZOOM,
      }),
    });
  
    const vectorSource = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({
      source: vectorSource,
    });
    map.addLayer(vectorLayer);
  
    let drawInteraction = null;
  
    const addInteractions = (geometryType) => {
      removeInteractions();
  
      drawInteraction = new ol.interaction.Draw({
        source: vectorSource,
        type: geometryType,
      });
      map.addInteraction(drawInteraction);
  
      drawInteraction.on("drawend", function (event) {
        const format = new ol.format.WKT();
        const wkt = format.writeGeometry(event.feature.getGeometry());
  
        Swal.fire({
          title: "Çizimi Tamamladınız",
          html: `
              <div style="text-align: center;">
                  <i class="fas fa-smile" style="font-size: 40px; color: #ffcc00; margin-bottom: 10px;"></i>
                  <p>Lütfen bir isim girin:</p>
              </div>
          `,
          input: "text",
          inputPlaceholder: "İsim girin",
          showCancelButton: true,
          confirmButtonText: "Kaydet",
          cancelButtonText: "İptal",
          customClass: {
            popup: "swal2-custom-popup",
            title: "swal2-custom-title",
            htmlContainer: "swal2-custom-html",
            input: "swal2-custom-input",
            confirmButton: "swal2-confirm-btn",
            cancelButton: "swal2-cancel-btn",
          },
          inputAttributes: {
            style: "width: 90%; padding: 8px; font-size: 14px;",
          },
          preConfirm: (name) => {
            if (!name) {
              Swal.showValidationMessage("İsim alanı boş olamaz");
              return false;
            }
            return name;
          },
        }).then((result) => {
          if (result.isConfirmed && result.value) {
            const geometryData = {
              WKT: wkt,
              Name: result.value,
            };
  
            saveGeometry(geometryData);
          }
        });
      });
    };
  
    const removeInteractions = () => {
      if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
      }
    };
  
    const saveGeometry = async (geometryData) => {
      try {
        const response = await fetch(API_BASE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geometryData),
        });
  
        if (response.ok) {
          Swal.fire("Başarılı", "Geometri başarıyla eklendi.", "success");
  
          // WKT formatını ve geometrinin oluşturulmasını kontrol et
          const wktFormat = new ol.format.WKT();
          const feature = wktFormat.readFeature(geometryData.WKT, {
            dataProjection: "EPSG:3857", // Eğer WKT verisi EPSG:3857 projeksiyonundaysa
            featureProjection: map.getView().getProjection(),
          });
  
          if (!feature) {
            console.error("Geometri oluşturulamadı. WKT:", geometryData.WKT);
            return;
          }
  
          feature.set("name", geometryData.Name);
          vectorSource.addFeature(feature);
  
          const extent = feature.getGeometry().getExtent();
          console.log("Extent:", extent);
  
          if (!ol.extent.isEmpty(extent)) {
            map.getView().fit(extent, { duration: 1000, maxZoom: 12 });
          } else {
            console.warn(
              "Geometri için boş bir extent sağlandı, fit işlemi atlanıyor."
            );
          }
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || "API isteği başarısız");
        }
      } catch (error) {
        console.error("Hata oluştu:", error);
        Swal.fire("Hata", error.message, "error");
      }
    };
  
    const loadMarkers = async () => {
      try {
        const response = await fetch(API_BASE_URL);
        const data = await response.json();
        if (data.status) {
          const points = data.value;
          const wktFormat = new ol.format.WKT();
  
          points.forEach((point) => {
            try {
              const feature = wktFormat.readFeature(point.wkt, {
                dataProjection: "EPSG:3857",
                featureProjection: map.getView().getProjection(),
              });
              feature.setId(point.id);
              feature.set("name", point.name);
              vectorSource.addFeature(feature);
            } catch (error) {
              console.error("WKT parse hatası:", point.wkt, error);
            }
          });
          
        } else {
          console.error("Veri çekme hatası:", data.message);
        }
      } catch (error) {
        console.error("Veri çekme hatası:", error);
      }
    };
  
    // Güncelleme Seçeneği Popup'ı
    window.updateGeometry = function (id) {
      Swal.fire({
        title: "Güncelleme Seçeneği",
        text: "Lütfen bir güncelleme yöntemi seçin:",
        showCancelButton: true,
        confirmButtonText: "Manuel",
        cancelButtonText: "Panel",
      }).then((result) => {
        if (result.isConfirmed) {
          // Manuel güncelleme seçildi
          window.manualUpdate(id);
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          // Panel üzerinden güncelleme seçildi
          window.panelUpdate(id);
        }
      });
    };
  
    // Manuel Güncelleme Fonksiyonu
    window.manualUpdate = function (id) {
      // Query panelini kapat
      resetMapView();
      const openPanels = jsPanel.getPanels();
      openPanels.forEach((panel) => panel.close());
  
      // Geometriyi sürükleyerek güncellemeye başla
      window.activateManualUpdate(id);
    };
  
    // Geometriyi manuel olarak güncellemek için fonksiyon
    window.activateManualUpdate = function (id) {
      // Seçilen geometriyi bulalım
      const feature = vectorSource.getFeatureById(id);
      if (!feature) {
        Swal.fire("Hata", "Geometri bulunamadı.", "error");
        return;
      }
  
      // Translate etkileşimini başlatalım (Geometriyi taşımak için)
      const translateInteraction = new ol.interaction.Translate({
        features: new ol.Collection([feature]),
      });
      map.addInteraction(translateInteraction);
  
      // Modify etkileşimini başlatalım (Geometrinin noktalarını değiştirmek için)
      const modifyInteraction = new ol.interaction.Modify({
        features: new ol.Collection([feature]),
      });
      map.addInteraction(modifyInteraction);
  
      // Geometri taşınıp veya noktaları değiştirildiğinde bu fonksiyon çalışır
      const onGeometryChange = function (event) {
        const modifiedFeature = event.features
          ? event.features.item(0)
          : event.target.getFeatures().item(0);
        const modifiedGeometry = modifiedFeature.getGeometry();
        const wktFormat = new ol.format.WKT();
        const updatedWKT = wktFormat.writeGeometry(modifiedGeometry);
  
        Swal.fire({
          title: "Güncelleme Onayı",
          text: "Bu güncellemeyi kaydetmek istiyor musunuz?",
          showCancelButton: true,
          confirmButtonText: "Evet",
          cancelButtonText: "Hayır",
        }).then((result) => {
          if (result.isConfirmed) {
            // Geometriyi kaydetmek için backend'e istekte bulunalım
            window.performManualUpdate(id, updatedWKT);
            // Etkileşimleri kaldır
            map.removeInteraction(modifyInteraction);
            map.removeInteraction(translateInteraction);
          } else {
            // Değişiklikleri iptal edelim
            feature
              .getGeometry()
              .setCoordinates(modifiedGeometry.getCoordinates());
            map.removeInteraction(modifyInteraction);
            map.removeInteraction(translateInteraction);
          }
        });
      };
  
      // Her iki etkileşimde de değişiklik olduğunda aynı fonksiyonu kullanırız
      modifyInteraction.on("modifyend", onGeometryChange);
      translateInteraction.on("translateend", onGeometryChange);
    };
  
    // Manuel Güncelleme İşlemini Backend'e Gönderme
    window.performManualUpdate = function (id, updatedWKT, name) {
      // Eğer isim boşsa, kullanıcıdan isim girmesini isteyin
      if (!name || name.trim() === "") {
        Swal.fire({
          title: "İsim Gerekli",
          text: "Lütfen bir isim girin:",
          input: "text",
          inputPlaceholder: "İsim girin",
          showCancelButton: true,
          confirmButtonText: "Kaydet",
          cancelButtonText: "İptal",
          preConfirm: (inputValue) => {
            if (!inputValue) {
              Swal.showValidationMessage("İsim alanı boş bırakılamaz.");
              return false;
            }
            return inputValue;
          },
        }).then((result) => {
          if (result.isConfirmed) {
            const updatedName = result.value;
            // İsim girildiğinde güncellemeyi tekrar çalıştır
            window.performManualUpdate(id, updatedWKT, updatedName);
          }
        });
      } else {
        // Güncelleme işlemini backend'e gönderin
        fetch(`${API_BASE_URL}/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, name, wkt: updatedWKT }),
        })
          .then((response) => {
            if (!response.ok) {
              return response.json().then((data) => {
                let errorMessage = "Güncelleme başarısız oldu.";
                if (data.errors) {
                  errorMessage = Object.values(data.errors).flat().join(" ");
                }
                throw new Error(errorMessage);
              });
            }
            return response.json();
          })
          .then((data) => {
            Swal.fire("Başarılı!", "Geometri güncellendi.", "success");
            loadMarkers(); // Haritayı güncellemek için markerları yeniden yükleyin
            resetMapView(); // Haritayı ilk açılış haline döndür
          })
          .catch((error) => {
            Swal.fire("Hata!", error.message, "error");
            console.error("Güncelleme hatası:", error);
          });
      }
    };
  
    // Panel üzerinden güncelleme işlemi
    window.performPanelUpdate = function (id, name, wkt) {
      fetch(`${API_BASE_URL}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, name, wkt }),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((data) => {
              let errorMessage = "Güncelleme başarısız oldu.";
              if (data.errors) {
                errorMessage = Object.values(data.errors).flat().join(" ");
              }
              throw new Error(errorMessage);
            });
          }
          return response.json();
        })
        .then((data) => {
          Swal.fire("Başarılı!", "Geometri güncellendi.", "success");
          loadMarkers(); // Haritayı güncellemek için markerları yeniden yükleyin
          resetMapView(); // Haritayı ilk açılış haline döndür
        })
        .catch((error) => {
          Swal.fire("Hata!", error.message, "error");
        });
    };
  
    // Panel üzerinden güncelleme işlemi
    window.panelUpdate = function (id) {
      // Geometri verilerini almak için API'yi çağır
      fetch(`${API_BASE_URL}/${id}`)
        .then((response) => response.json())
        .then((point) => {
          if (!point || !point.value) {
            throw new Error("Geometri verisi bulunamadı");
          }
  
          const existingName = point.value.name;
          const existingWKT = point.value.wkt;
  
          // SweetAlert2 ile bir popup aç ve mevcut bilgileri yerleştir
          Swal.fire({
            title: "Geometri Güncelle",
            html: `
                        <div style="text-align: left;">
                            <label for="name" style="display: block; font-weight: bold; margin-bottom: 5px;">Yeni İsim:</label>
                            <input type="text" id="name" class="swal2-input" value="${existingName}" placeholder="İsim girin" style="width: 100%; box-sizing: border-box;">
                        </div>
                        <div style="text-align: left; margin-top: 10px;">
                            <label for="wkt" style="display: block; font-weight: bold; margin-bottom: 5px;">Yeni WKT:</label>
                            <textarea id="wkt" class="swal2-textarea" style="width: 100%; height: 100px; box-sizing: border-box;">${existingWKT}</textarea>
                        </div>
                    `,
            confirmButtonText: "Güncelle",
            showCancelButton: true,
            preConfirm: () => {
              const name = Swal.getPopup().querySelector("#name").value;
              const wkt = Swal.getPopup().querySelector("#wkt").value;
              if (!name || !wkt) {
                Swal.showValidationMessage("Tüm alanları doldurmanız gerekiyor");
                return false;
              }
              return { name, wkt };
            },
          }).then((result) => {
            if (result.isConfirmed) {
              // Güncelleme işlemini yap
              window.performPanelUpdate(id, result.value.name, result.value.wkt);
            }
          });
        })
        .catch((error) => {
          Swal.fire("Hata", error.message, "error");
        });
    };
  
    window.showDetails = async function (id) {
      try {
        const response = await fetch(`${API_BASE_URL}/${id}`);
        if (!response.ok) throw new Error("Failed to fetch point data");
  
        const data = await response.json();
        const point = data.value;
  
        if (!point) throw new Error("Geometry not found");
  
        const wktFormat = new ol.format.WKT();
        const pointCoords = wktFormat.readGeometry(point.wkt, {
          dataProjection: "EPSG:3857", // Projeksiyonu kontrol edin
          featureProjection: map.getView().getProjection(),
        });
  
        // Haritayı WKT geometrisine fit et ve query panelini kapat
        const extent = pointCoords.getExtent();
        map.getView().fit(extent, { duration: 1000 });
  
        // Açık olan tüm jsPanel panellerini kapat
        const openPanels = jsPanel.getPanels();
        openPanels.forEach((panel) => panel.close());
  
        // Popup içeriğini güncelle
        document.getElementById("popup-id").innerText = point.id;
        document.getElementById("popup-name").innerText = point.name;
        document.getElementById("popup-wkt").innerText = point.wkt;
        document
          .getElementById("update-btn")
          .classList.add("edit-btn", "popup-btn"); // Düzenleme Butonu (Yeşil)
        document
          .getElementById("delete-btn")
          .classList.add("delete-btn", "popup-btn"); // Silme Butonu (Kırmızı)
        document
          .getElementById("close-popup-btn")
          .classList.add("close-btn", "popup-btn"); // Kapatma Butonu (Gri)
  
        // Popup'ı harita üzerinde göster
        const popup = document.getElementById("popup");
        const coordinate = pointCoords.getLastCoordinate(); // Geometrinin son koordinatını al
  
        const pixel = map.getPixelFromCoordinate(coordinate);
        popup.style.left = `${pixel[0]}px`;
        popup.style.top = `${pixel[1]}px`;
        popup.style.display = "block";
        document.getElementById("update-btn").innerHTML =
          '<i class="fas fa-edit"></i>'; // Sadece Düzenleme ikonu
        document.getElementById("delete-btn").innerHTML =
          '<i class="fas fa-trash"></i>'; // Sadece Silme ikonu
        document.getElementById("close-popup-btn").innerHTML =
          '<i class="fas fa-times"></i>'; // Sadece Kapatma ikonu
  
        // Güncelle ve Sil butonlarına işlev ekle
        document.getElementById("update-btn").onclick = function () {
          updateGeometry(id);
          closePopup();
        };
  
        document.getElementById("delete-btn").onclick = function () {
          deleteGeometry(id);
          closePopup();
        };
  
        // Popup'ı kapat butonuna işlev ekle
        document.getElementById("close-popup-btn").onclick = function () {
          closePopup();
          resetMapView(); // Haritayı ilk haline döndür
        };
      } catch (error) {
        console.error("Error:", error.message);
      }
    };
  
    function closePopup() {
      document.getElementById("popup").style.display = "none";
    }
  
    function resetMapView() {
      // Haritayı ilk haline döndür
      map.getView().animate({
        center: ol.proj.fromLonLat(INITIAL_COORDINATES),
        zoom: INITIAL_ZOOM,
        duration: 1000,
      });
    }
  
    function closePopup() {
      document.getElementById("popup").style.display = "none";
    }
  
    // Harita üzerinde tıklama olayını dinleyelim
    map.on("singleclick", function (evt) {
      // Tıklanan pikseldeki özellikleri (geometrileri) alalım
      map.forEachFeatureAtPixel(evt.pixel, function (feature) {
        // Feature'ın ID'sini alalım (Bu ID, veritabanındaki ID olmalı)
        const id = feature.getId();
  
        if (id) {
          // Eğer ID varsa, showDetails fonksiyonunu çağır
          window.showDetails(id);
        }
      });
    });
  
    window.deleteGeometry = async function (id) {
      const confirmDelete = await Swal.fire({
        title: "Emin misiniz?",
        text: `ID'si ${id} olan geometrik şekli silmek istiyor musunuz?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Evet!",
        cancelButtonText: "Hayır",
      });
  
      if (confirmDelete.isConfirmed) {
        try {
          const response = await fetch(`${API_BASE_URL}/${id}`, {
            method: "DELETE",
          });
  
          if (response.ok) {
            Swal.fire(
              "Silindi!",
              `ID'si ${id} olan geometrik şekil silindi.`,
              "success"
            );
            vectorSource.clear(); // Tüm mevcut geometrileri kaldır
            loadMarkers(); // Geometrileri yeniden yükleyin
            resetMapView(); // Haritayı ilk haline döndür
  
            // Query paneli kapat
            const openPanels = jsPanel.getPanels();
            openPanels.forEach((panel) => panel.close());
          } else {
            const errorText = await response.text();
            console.error("Silme işlemi başarısız:", errorText);
            throw new Error(errorText || "Delete failed");
          }
        } catch (error) {
          console.error("Silme işlemi başarısız:", error);
          Swal.fire("Hata", `Silme işlemi başarısız: ${error.message}`, "error");
        }
      } else {
        resetMapView(); // Hayır'a basıldığında haritayı ilk haline döndür
      }
    };
    geometryBtn.addEventListener("click", () => {
      Swal.fire({
        title: "Geometri Türü Seçin",
        html: `
              <select id="geometryType" class="swal2-input">
                  <option value="" disabled selected>Geometri Türünü Seçin</option>
                  <option value="LineString">LineString</option>
                  <option value="Polygon">Polygon</option>
              </select>
          `,
        confirmButtonText: "Seç",
        showCancelButton: true,
        cancelButtonText: "İptal",
        customClass: {
          popup: "swal2-custom-popup",
          title: "swal2-custom-title",
          htmlContainer: "swal2-custom-html",
          confirmButton: "swal2-confirm-btn",
          cancelButton: "swal2-cancel-btn",
        },
        preConfirm: () => {
          const selectedType = document.getElementById("geometryType").value;
          if (!selectedType) {
            Swal.showValidationMessage("Lütfen bir geometri türü seçin.");
            return false;
          }
          return selectedType;
        },
      }).then((result) => {
        if (result.isConfirmed) {
          const selectedType = result.value;
          addInteractions(selectedType);
          Swal.fire(
            "Geometri Seçildi",
            `Seçilen Geometri: ${selectedType}`,
            "success"
          );
        }
      });
    });
  
    const openQueryPanel = async () => {
      try {
        const response = await fetch(API_BASE_URL);
        if (!response.ok) {
          throw new Error(`API çağrısı başarısız: ${response.status}`);
        }
        const data = await response.json();
        if (data.status) {
          const points = data.value;
          const html = generateGeometriesTableHTML(points);
          showQueryPanel(html);
        } else {
          Swal.fire("Hata", data.message, "error");
        }
      } catch (error) {
        Swal.fire("Hata", error.message, "error");
      }
    };
  
    const generateGeometriesTableHTML = (points) => {
      let html = `
          <table class="table table-bordered">
              <thead>
                  <tr>
                      <th>WKT</th>
                      <th>Name</th>
                      <th>Actions</th>
                  </tr>
              </thead>
              <tbody>
      `;
  
      points.forEach((point) => {
        html += `
              <tr>
                  <td>${point.wkt}</td>
                  <td>${point.name}</td>
                  <td>
                      <button class="btn btn-info btn-sm" onclick="showDetails(${point.id})">
                          <i class="fas fa-eye"></i>
                      </button>
                      <button class="btn btn-warning btn-sm" onclick="updateGeometry(${point.id})">
                          <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn btn-danger btn-sm" onclick="deleteGeometry(${point.id})">
                          <i class="fas fa-trash"></i>
                      </button>
                  </td>
              </tr>
          `;
      });
  
      html += `
              </tbody>
          </table>
      `;
  
      return html;
    };
  
    const showQueryPanel = (html) => {
      jsPanel.create({
        position: "center",
        contentSize: "850 450",
        headerTitle: "Geometries",
        theme: "primary",
        content: html,
      });
    };
  
    queryBtn.addEventListener("click", openQueryPanel);
  
    resetViewBtn.addEventListener("click", () => {
      map.getView().animate({
        center: ol.proj.fromLonLat(INITIAL_COORDINATES),
        zoom: INITIAL_ZOOM,
        duration: 1000,
      });
    });
  
    // Uygulama yüklendiğinde mevcut geometrileri yükleyelim
    loadMarkers();
  });
  