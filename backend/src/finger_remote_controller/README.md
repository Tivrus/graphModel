# finger_remote_controller

Библиотека для отслеживания пальцев и управления системами жестами (MediaPipe Hands).

Работает **локально**, без интернета (модель лежит в `models/`).

## Установка в другой проект (drop-in)

Скопируй **всю папку** `finger_remote_controller` сюда:

```text
твой_проект/venv/Lib/site-packages/finger_remote_controller/
```

> Важно: именно `Lib/site-packages/`, не просто `Lib/`.

В venv проекта поставь зависимости:

```bash
pip install mediapipe opencv-python numpy
```

или:

```bash
pip install -r finger_remote_controller/requirements.txt
```

Модель `models/hand_landmarker.task` должна быть внутри папки (уже лежит вместе с библиотекой).

## Быстрый старт — управление системой

```python
from finger_remote_controller import FingerRemote

# camera=None → берёт сохранённую камеру, иначе открывает picker
remote = FingerRemote()

@remote.on("fist")
def emergency_stop(action, result):
    print("STOP", action.confidence)

@remote.on("open_palm")
def resume(action, result):
    print("RESUME")

remote.on("swipe_left", lambda action, result: print("PREV"))
remote.on("swipe_right", lambda action, result: print("NEXT"))
remote.on("pinch", lambda action, result: print("CLICK"))

remote.run(show_preview=True)  # Q/Esc — выход, C — сменить камеру
```

## Камеры (выбор + сохранение)

Выбор сохраняется в `~/.finger_remote_controller/settings.json` и подхватывается в других проектах.

```python
from finger_remote_controller import CameraSelector, get_saved_camera, save_camera

cams = CameraSelector()
cams.print()                 # список камер (+ какая saved)
index = cams.pick()          # превью → выбор → автосохранение
print(get_saved_camera())    # например 2

# явно
save_camera(1)
cap, index = cams.open()     # открыть сохранённую / выбрать
```

В picker:
- `0-9` — выбрать камеру по индексу  
- `←` / `→` — подсветка, `Enter` — подтвердить  
- `C` — сбросить сохранённую  
- `Esc` / `Q` — отмена  

```python
remote = FingerRemote()
remote.pick_camera()                 # принудительный выбор
remote.run(force_pick_camera=True)   # выбрать при старте
# во время preview: C — сменить камеру на лету
```

Несколько действий сразу:

```python
remote.bind({
    "thumbs_up": lambda a, r: power_on(),
    "point": lambda a, r: aim(),
    "victory": lambda a, r: confirm(),
})
```

## Низкоуровневый API (свой цикл камеры)

```python
import cv2
from finger_remote_controller import HandTracker

cap = cv2.VideoCapture(0)
with HandTracker() as tracker:
    ts = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        result = tracker.process(frame, timestamp_ms=ts)
        ts += 33
        if result.primary_action:
            print(result.primary_action.name, result.hands[0].fingers.as_dict())
```

## Жесты

| Имя | Смысл |
|---|---|
| `fist` | Кулак |
| `open_palm` | Ладонь |
| `point` | Указательный |
| `victory` | V |
| `thumbs_up` | Лайк |
| `pinch` | Щипок |
| `rock` / `love` / `horn` | Комбинации пальцев |
| `swipe_left` / `right` / `up` / `down` | Свайп |
| `fingers_N` | N пальцев |
| `*` | Любой жест (в `on`) |

## Параметры FingerRemote

| Параметр | По умолчанию | Зачем |
|---|---|---|
| `camera` | `None` | Индекс; `None` = saved / picker |
| `prefer_saved_camera` | `True` | Брать камеру из settings.json |
| `save_camera_choice` | `True` | Запоминать выбранную камеру |
| `min_confidence` | `0.7` | Мин. уверенность жеста |
| `hold_frames` | `3` | Кадров удержания жеста |
| `cooldown_ms` | `600` | Пауза между повторными срабатываниями |
| `mirror` | `True` | Зеркало (как в селфи) |

## Демо

```bash
python -m finger_remote_controller                # saved или picker
python -m finger_remote_controller --camera 2     # выбрать и сохранить
python -m finger_remote_controller --pick-camera  # принудительный picker
python -m finger_remote_controller --list-cameras
python -m finger_remote_controller --clear-camera
```

Во время превью: `C` — сменить камеру, `Q` / `Esc` — выход.

## Состав папки

```text
finger_remote_controller/
  README.md
  requirements.txt
  __init__.py
  controller.py      # FingerRemote — управление системами
  camera.py          # список / picker / CameraSelector
  settings.py        # сохранение камеры (~/.finger_remote_controller/)
  tracker.py         # MediaPipe Hand Landmarker
  actions.py         # распознавание жестов
  models/
    hand_landmarker.task
  ...
```
