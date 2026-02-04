import { useEffect, useRef, useState } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

/**
 * VideoPlayer - Video player using Plyr with custom controls
 * 
 * @param {Object} props
 * @param {string} props.url - URL of the video file
 * @param {string} props.title - Title for accessibility
 * @param {string} props.poster - Optional poster image URL
 * @param {function} props.onReady - Callback when player is ready
 * @param {function} props.onPlay - Callback when video plays
 * @param {function} props.onPause - Callback when video pauses
 * @param {function} props.onEnded - Callback when video ends
 * @param {function} props.onTimeUpdate - Callback with current time update
 */
export default function VideoPlayer({ 
  url, 
  title = 'Video', 
  poster,
  onReady,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate
}) {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!videoRef.current) return

    // Initialize Plyr
    const player = new Plyr(videoRef.current, {
      controls: [
        'play-large',
        'rewind',
        'play',
        'fast-forward',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'captions',
        'settings',
        'pip',
        'airplay',
        'fullscreen'
      ],
      settings: ['captions', 'quality', 'speed'],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
      captions: { active: false, language: 'auto', update: true },
      fullscreen: { enabled: true, fallback: true, iosNative: true },
      ratio: '16:9',
      blankVideo: 'https://cdn.plyr.io/static/blank.mp4',
      storage: { enabled: true, key: 'lms-plyr' }
    })

    playerRef.current = player

    // Event handlers
    player.on('ready', () => {
      if (onReady) onReady(player)
    })

    player.on('play', () => {
      if (onPlay) onPlay()
    })

    player.on('pause', () => {
      if (onPause) onPause()
    })

    player.on('ended', () => {
      if (onEnded) onEnded()
    })

    player.on('timeupdate', () => {
      if (onTimeUpdate) {
        onTimeUpdate({
          currentTime: player.currentTime,
          duration: player.duration,
          percentage: player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0
        })
      }
    })

    player.on('error', () => {
      setError(true)
    })

    return () => {
      player.destroy()
    }
  }, [url])

  const handleError = () => {
    setError(true)
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center aspect-video flex items-center justify-center">
        <div>
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-400 mb-2">Unable to load video</p>
          <p className="text-gray-500 text-sm">Please check your connection and try again</p>
          <button
            onClick={() => {
              setError(false)
              if (videoRef.current) {
                videoRef.current.load()
              }
            }}
            className="mt-4 btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="video-player-container rounded-lg overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="plyr-react plyr"
        playsInline
        crossOrigin="anonymous"
        poster={poster}
        onError={handleError}
      >
        <source src={url} type={getVideoMimeType(url)} />
        Your browser does not support the video tag.
      </video>

      <style>{`
        .video-player-container .plyr {
          --plyr-color-main: #3b82f6;
          --plyr-video-background: #000;
        }
        .video-player-container .plyr--full-ui input[type=range] {
          color: var(--plyr-color-main);
        }
        .video-player-container .plyr__control--overlaid {
          background: var(--plyr-color-main);
        }
        .video-player-container .plyr__control--overlaid:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  )
}

/**
 * Get MIME type from video URL
 */
function getVideoMimeType(url) {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0]
  const mimeTypes = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo'
  }
  return mimeTypes[ext] || 'video/mp4'
}
