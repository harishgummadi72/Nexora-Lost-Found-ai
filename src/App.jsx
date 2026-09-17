import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { generateDinoV2Embedding } from './lib/dinov2'

function App() {
  const [user, setUser] = useState(null)
  const [flipped, setFlipped] = useState(false)
  const [activePage, setActivePage] = useState('Dashboard')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [fullName, setFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  /* =========================================
     LIVE DATA
  ========================================= */

  const [matches, setMatches] = useState([])
  const [activity, setActivity] = useState([])
  const [notifications, setNotifications] = useState([])

  const [matchCount, setMatchCount] = useState(0)
  const [lostItemCount, setLostItemCount] = useState(0)
  const [foundItemCount, setFoundItemCount] = useState(0)

  const [dataLoading, setDataLoading] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)

  /* =========================================
     LOST ITEM STATE
  ========================================= */

  const [lostTitle, setLostTitle] = useState('')
  const [lostDescription, setLostDescription] = useState('')
  const [lostCategory, setLostCategory] = useState('')
  const [lostBrand, setLostBrand] = useState('')
  const [lostColor, setLostColor] = useState('')
  const [lostLocation, setLostLocation] = useState('')
  const [lostDate, setLostDate] = useState('')
  const [lostImage, setLostImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')

  /* =========================================
     FOUND ITEM STATE
  ========================================= */

  const [foundTitle, setFoundTitle] = useState('')
  const [foundDescription, setFoundDescription] = useState('')
  const [foundCategory, setFoundCategory] = useState('')
  const [foundBrand, setFoundBrand] = useState('')
  const [foundColor, setFoundColor] = useState('')
  const [foundLocation, setFoundLocation] = useState('')
  const [foundDate, setFoundDate] = useState('')
  const [foundImage, setFoundImage] = useState(null)
  const [foundImagePreview, setFoundImagePreview] = useState('')
  const [foundSubmitMessage, setFoundSubmitMessage] = useState('')

  /* =========================================
     AUTH
  ========================================= */

  useEffect(() => {
    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)

      if (!session?.user) {
        clearUserData()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function checkUser() {
    const { data } = await supabase.auth.getUser()
    setUser(data.user ?? null)
  }

  function clearUserData() {
    setMatches([])
    setActivity([])
    setNotifications([])
    setMatchCount(0)
    setLostItemCount(0)
    setFoundItemCount(0)
  }

  /* =========================================
     LOAD EVERYTHING
  ========================================= */

  useEffect(() => {
    if (!user) return

    refreshAllData()
    // The effect intentionally reruns only when auth or the active page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activePage])

  async function refreshAllData() {
    if (!user) return

    await Promise.all([
      loadMatches(),
      loadActivity(),
      loadDashboardStats(),
    ])
  }

 async function loadMatches() {
  if (!user) return

  setDataLoading(true)

  try {
    // --------------------------------------------------
    // 1. Get MY lost items
    // --------------------------------------------------
    const { data: myLostItems, error: lostError } =
      await supabase
        .from('lost_items')
        .select('*')
        .eq('user_id', user.id)

    if (lostError) {
      console.error('My lost items error:', lostError)
    }

    // --------------------------------------------------
    // 2. Get MY found items
    // --------------------------------------------------
    const { data: myFoundItems, error: foundError } =
      await supabase
        .from('found_items')
        .select('*')
        .eq('user_id', user.id)

    if (foundError) {
      console.error('My found items error:', foundError)
    }

    const lostIds = (myLostItems || []).map(item => item.id)
    const foundIds = (myFoundItems || []).map(item => item.id)

    // No items = no matches
    if (!lostIds.length && !foundIds.length) {
      setMatches([])
      setMatchCount(0)
      return
    }

    // --------------------------------------------------
    // 3. Get matches belonging to MY lost items
    //    or MY found items
    // --------------------------------------------------
    const requests = []

    if (lostIds.length) {
      requests.push(
        supabase
          .from('match_results')
          .select('*')
          .in('lost_item_id', lostIds)
      )
    }

    if (foundIds.length) {
      requests.push(
        supabase
          .from('match_results')
          .select('*')
          .in('found_item_id', foundIds)
      )
    }

    const results = await Promise.all(requests)

    const matchError =
      results.find(result => result.error)?.error || null

    if (matchError) {
      console.error('Match results error:', matchError)

      setMatches([])
      setMatchCount(0)

      return
    }

    // --------------------------------------------------
    // 4. Remove duplicate rows
    // --------------------------------------------------
    const uniqueMatches = Array.from(
      new Map(
        results
          .flatMap(result => result.data || [])
          .map(match => [match.id, match])
      ).values()
    )

    if (!uniqueMatches.length) {
      setMatches([])
      setMatchCount(0)
      return
    }

    // --------------------------------------------------
    // 5. Get IDs of linked items
    // --------------------------------------------------
    const allLostIds = [
      ...new Set(
        uniqueMatches
          .map(match => match.lost_item_id)
          .filter(Boolean)
      )
    ]

    const allFoundIds = [
      ...new Set(
        uniqueMatches
          .map(match => match.found_item_id)
          .filter(Boolean)
      )
    ]

    // --------------------------------------------------
    // 6. Load linked lost items
    // --------------------------------------------------
    let linkedLostItems = []

    if (allLostIds.length) {
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .in('id', allLostIds)

      if (error) {
        console.error('Linked lost items error:', error)
      } else {
        linkedLostItems = data || []
      }
    }

    // --------------------------------------------------
    // 7. Load linked found items
    // --------------------------------------------------
    let linkedFoundItems = []

    if (allFoundIds.length) {
      const { data, error } = await supabase
        .from('found_items')
        .select('*')
        .in('id', allFoundIds)

      if (error) {
        console.error('Linked found items error:', error)
      } else {
        linkedFoundItems = data || []
      }
    }

    // --------------------------------------------------
    // 8. Build frontend match objects
    // --------------------------------------------------
    const formattedMatches = uniqueMatches
      .map(match => {
        const lostItem =
          linkedLostItems.find(
            item => item.id === match.lost_item_id
          ) ||
          myLostItems?.find(
            item => item.id === match.lost_item_id
          ) ||
          null

        const foundItem =
          linkedFoundItems.find(
            item => item.id === match.found_item_id
          ) ||
          myFoundItems?.find(
            item => item.id === match.found_item_id
          ) ||
          null

        return {
          ...match,
          lostItem,
          foundItem,

          isMyLostItem: lostIds.includes(
            match.lost_item_id
          ),

          isMyFoundItem: foundIds.includes(
            match.found_item_id
          ),
        }
      })
      .sort((a, b) => {
        const dateA = a.created_at
          ? new Date(a.created_at).getTime()
          : 0

        const dateB = b.created_at
          ? new Date(b.created_at).getTime()
          : 0

        return dateB - dateA
      })

    // --------------------------------------------------
    // 9. Update UI
    // --------------------------------------------------
    setMatches(formattedMatches)
    setMatchCount(formattedMatches.length)

    console.log(
      'Nexora matches loaded:',
      formattedMatches
    )

  } catch (error) {
    console.error(
      'Loading matches failed:',
      error
    )

    setMatches([])
    setMatchCount(0)

  } finally {
    setDataLoading(false)
  }
}
  /* =========================================
     LOAD ACTIVITY
  ========================================= */

  async function loadActivity() {
    if (!user) return

    try {
      const [
        { data: lostItems, error: lostError },
        { data: foundItems, error: foundError },
      ] = await Promise.all([
        supabase
          .from('lost_items')
          .select('*')
          .eq('user_id', user.id),

        supabase
          .from('found_items')
          .select('*')
          .eq('user_id', user.id),
      ])

      if (lostError) {
        console.error('Activity lost error:', lostError)
      }

      if (foundError) {
        console.error('Activity found error:', foundError)
      }

      const myLostIds = (lostItems || []).map(
        item => item.id
      )

      const myFoundIds = (foundItems || []).map(
        item => item.id
      )

      const { data: matchRows, error: matchError } =
        await supabase
          .from('match_results')
          .select('*')

      if (matchError) {
        console.error('Activity match error:', matchError)
      }

      const myMatches = (matchRows || [])
        .filter(match =>
          myLostIds.includes(match.lost_item_id) ||
          myFoundIds.includes(match.found_item_id)
        )

      const events = [
        ...(lostItems || []).map(item => ({
          id: `lost-${item.id}`,
          type: 'lost',
          title: `Reported lost: ${item.title}`,
          location: item.location,
          date: item.created_at,
        })),

        ...(foundItems || []).map(item => ({
          id: `found-${item.id}`,
          type: 'found',
          title: `Reported found: ${item.title}`,
          location: item.location,
          date: item.created_at,
        })),

        ...myMatches.map(match => {
          const score =
            Number(match.similarity_score) || 0

          return {
            id: `match-${match.id}`,
            type: 'match',
            title: `AI match found: ${score.toFixed(2)}%`,
            location: null,
            date:
              match.created_at ||
              match.updated_at ||
              new Date().toISOString(),
          }
        }),
      ]

      events.sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      )

      setActivity(events)

      /* =========================================
         NOTIFICATIONS
      ========================================= */

      const notificationItems = myMatches.map(
        match => {
          const score =
            Number(match.similarity_score) || 0

          return {
            id: `match-${match.id}`,
            type: 'match',
            title: 'AI Match Found',
            text: `Nexora found a ${score.toFixed(
              2
            )}% visual match for your item.`,
            date:
              match.created_at ||
              match.updated_at ||
              new Date().toISOString(),
          }
        }
      )

      setNotifications(
        notificationItems
          .sort(
            (a, b) =>
              new Date(b.date) -
              new Date(a.date)
          )
          .slice(0, 10)
      )

    } catch (error) {
      console.error(
        'Loading activity failed:',
        error
      )
    }
  }

  /* =========================================
     DASHBOARD STATS
  ========================================= */

  async function loadDashboardStats() {
    if (!user) return

    try {
      const [
        { count: lostCount, error: lostError },
        { count: foundCount, error: foundError },
      ] = await Promise.all([
        supabase
          .from('lost_items')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('user_id', user.id),

        supabase
          .from('found_items')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('user_id', user.id),
      ])

      if (lostError) {
        console.error('Lost count error:', lostError)
      }

      if (foundError) {
        console.error('Found count error:', foundError)
      }

      setLostItemCount(lostCount || 0)
      setFoundItemCount(foundCount || 0)

    } catch (error) {
      console.error(
        'Dashboard stats error:',
        error
      )
    }
  }

  /* =========================================
     LOGIN
  ========================================= */

  async function handleLogin(event) {
    event.preventDefault()

    setLoading(true)
    setMessage('')

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })

    if (error) {
      setMessage(error.message)
    } else {
      setUser(data.user)
      setActivePage('Dashboard')
    }

    setLoading(false)
  }

  /* =========================================
     SIGNUP
  ========================================= */

  async function handleSignup(event) {
    event.preventDefault()

    setLoading(true)
    setMessage('')

    const { data, error } =
      await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

    if (error) {
      setMessage(error.message)
    } else if (data.session) {
      setUser(data.user)
      setActivePage('Dashboard')
    } else {
      setMessage(
        'Account created! Please check your email. ✅'
      )
    }

    setLoading(false)
  }

  /* =========================================
     LOGOUT
  ========================================= */

  async function handleLogout() {
    await supabase.auth.signOut()

    setUser(null)
    setActivePage('Dashboard')
    clearUserData()
  }

  /* =========================================
     LOST IMAGE
  ========================================= */

  function handleImageChange(event) {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setSubmitMessage('Please select an image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setSubmitMessage(
        'Image must be smaller than 5 MB.'
      )
      return
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setLostImage(file)
    setImagePreview(
      URL.createObjectURL(file)
    )
    setSubmitMessage('')
  }

  /* =========================================
     FOUND IMAGE
  ========================================= */

  function handleFoundImageChange(event) {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setFoundSubmitMessage(
        'Please select an image.'
      )
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setFoundSubmitMessage(
        'Image must be smaller than 5 MB.'
      )
      return
    }

    if (foundImagePreview) {
      URL.revokeObjectURL(
        foundImagePreview
      )
    }

    setFoundImage(file)
    setFoundImagePreview(
      URL.createObjectURL(file)
    )
    setFoundSubmitMessage('')
  }

  /* =========================================
     USER DISPLAY NAME
  ========================================= */

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'User'
    /* =========================================
     LOST ITEM SUBMIT
  ========================================= */

  async function handleLostItemSubmit(event) {
    event.preventDefault()

    if (!user) {
      setSubmitMessage(
        'Please sign in first.'
      )
      return
    }

    if (!lostTitle.trim()) {
      setSubmitMessage(
        'Please enter the item name.'
      )
      return
    }

    if (!lostCategory) {
      setSubmitMessage(
        'Please select a category.'
      )
      return
    }

    if (!lostLocation.trim()) {
      setSubmitMessage(
        'Please enter where you lost the item.'
      )
      return
    }

    if (!lostImage) {
      setSubmitMessage(
        'Please upload an image.'
      )
      return
    }

    setLoading(true)
    setSubmitMessage(
      'Loading Nexora AI...'
    )

    let embedding

    try {
      const imageUrl = URL.createObjectURL(lostImage)

      try {
        embedding = await generateDinoV2Embedding(imageUrl)
      } finally {
        URL.revokeObjectURL(imageUrl)
      }

      setSubmitMessage(
        'Saving your lost item...'
      )

      const { data: item, error: itemError } =
        await supabase
          .from('lost_items')
          .insert({
            user_id: user.id,
            title: lostTitle.trim(),
            description:
              lostDescription.trim() || null,
            category: lostCategory,
            brand:
              lostBrand.trim() || null,
            color:
              lostColor.trim() || null,
            location: lostLocation.trim(),
            lost_date:
              lostDate || null,
          })
          .select()
          .single()

      if (itemError) throw itemError

      const extension =
        lostImage.name
          .split('.')
          .pop()
          ?.toLowerCase() || 'jpg'

      const filePath =
        `${user.id}/${item.id}/${crypto.randomUUID()}.${extension}`

      setSubmitMessage(
        'Uploading item image...'
      )

      const { error: uploadError } =
        await supabase.storage
          .from('item-images')
          .upload(
            filePath,
            lostImage,
            {
              cacheControl: '3600',
              upsert: false,
              contentType:
                lostImage.type,
            }
          )

      if (uploadError) {
        await supabase
          .from('lost_items')
          .delete()
          .eq('id', item.id)

        throw uploadError
      }

      setSubmitMessage(
        'Preparing item for AI matching...'
      )

      const {
        data: imageRecord,
        error: imageError,
      } = await supabase
        .from('item_images')
        .insert({
          user_id: user.id,
          lost_item_id: item.id,
          image_path: filePath,
          ai_status: 'pending',
        })
        .select()
        .single()

      if (imageError) {
        await supabase.storage
          .from('item-images')
          .remove([filePath])

        await supabase
          .from('lost_items')
          .delete()
          .eq('id', item.id)

        throw imageError
      }

      setSubmitMessage(
        'Running Nexora AI matching...'
      )

      const {
        data: aiResult,
        error: aiError,
      } =
        await supabase.functions.invoke(
          'process-item-image',
          {
            body: {
              item_image_id:
                imageRecord.id,
              embedding,
            },
          }
        )

      if (aiError) {
        console.error(
          'AI processing error:',
          aiError
        )

        setSubmitMessage(
          'Item saved, but AI matching could not be completed yet.'
        )
      } else if (!aiResult?.success) {
        console.error(
          'AI processing failed:',
          aiResult?.error
        )

        setSubmitMessage(
          'Item saved, but AI matching could not be completed yet.'
        )
      } else {
        const match =
          aiResult?.match || null

        if (match) {
          const score =
            Number(
              match.similarity_score
            ) || 0

          setSubmitMessage(
            `Lost item submitted! Nexora found a ${score.toFixed(
              2
            )}% potential match. 🔎`
          )
        } else {
          setSubmitMessage(
            'Lost item submitted and AI matching completed. No potential match yet. ✅'
          )
        }
      }

      setLostTitle('')
      setLostDescription('')
      setLostCategory('')
      setLostBrand('')
      setLostColor('')
      setLostLocation('')
      setLostDate('')
      setLostImage(null)

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }

      setImagePreview('')

      const imageInput =
        document.getElementById(
          'lost-item-image'
        )

      if (imageInput) {
        imageInput.value = ''
      }

      /*
       * Give the database a moment to finish
       * committing match_results, then refresh.
       */
      await new Promise(resolve =>
        setTimeout(resolve, 500)
      )

      await refreshAllData()

    } catch (error) {
      console.error(
        'Lost item submission error:',
        error
      )

      setSubmitMessage(
        error?.message ||
          'Something went wrong while submitting the item.'
      )
    } finally {
      setLoading(false)
    }
  }

  /* =========================================
     FOUND ITEM SUBMIT
  ========================================= */

  async function handleFoundItemSubmit(event) {
    event.preventDefault()

    if (!user) {
      setFoundSubmitMessage(
        'Please sign in first.'
      )
      return
    }

    if (!foundTitle.trim()) {
      setFoundSubmitMessage(
        'Please enter the item name.'
      )
      return
    }

    if (!foundCategory) {
      setFoundSubmitMessage(
        'Please select a category.'
      )
      return
    }

    if (!foundLocation.trim()) {
      setFoundSubmitMessage(
        'Please enter where you found the item.'
      )
      return
    }

    if (!foundImage) {
      setFoundSubmitMessage(
        'Please upload an image.'
      )
      return
    }

    setLoading(true)

    setFoundSubmitMessage(
      'Loading Nexora AI...'
    )

    let embedding

    try {
      const imageUrl = URL.createObjectURL(foundImage)

      try {
        embedding = await generateDinoV2Embedding(imageUrl)
      } finally {
        URL.revokeObjectURL(imageUrl)
      }

      setFoundSubmitMessage(
        'Saving your found item...'
      )

      const { data: item, error: itemError } =
        await supabase
          .from('found_items')
          .insert({
            user_id: user.id,
            title: foundTitle.trim(),
            description:
              foundDescription.trim() || null,
            category: foundCategory,
            brand:
              foundBrand.trim() || null,
            color:
              foundColor.trim() || null,
            location:
              foundLocation.trim(),
            found_date:
              foundDate || null,
          })
          .select()
          .single()

      if (itemError) throw itemError

      const extension =
        foundImage.name
          .split('.')
          .pop()
          ?.toLowerCase() || 'jpg'

      const filePath =
        `${user.id}/${item.id}/${crypto.randomUUID()}.${extension}`

      setFoundSubmitMessage(
        'Uploading found item image...'
      )

      const { error: uploadError } =
        await supabase.storage
          .from('item-images')
          .upload(
            filePath,
            foundImage,
            {
              cacheControl: '3600',
              upsert: false,
              contentType:
                foundImage.type,
            }
          )

      if (uploadError) {
        await supabase
          .from('found_items')
          .delete()
          .eq('id', item.id)

        throw uploadError
      }

      setFoundSubmitMessage(
        'Preparing item for AI matching...'
      )

      const {
        data: imageRecord,
        error: imageError,
      } = await supabase
        .from('item_images')
        .insert({
          user_id: user.id,
          found_item_id: item.id,
          image_path: filePath,
          ai_status: 'pending',
        })
        .select()
        .single()

      if (imageError) {
        await supabase.storage
          .from('item-images')
          .remove([filePath])

        await supabase
          .from('found_items')
          .delete()
          .eq('id', item.id)

        throw imageError
      }

      setFoundSubmitMessage(
        'Running Nexora AI matching...'
      )

      const {
        data: aiResult,
        error: aiError,
      } =
        await supabase.functions.invoke(
          'process-item-image',
          {
            body: {
              item_image_id:
                imageRecord.id,
              embedding,
            },
          }
        )

      if (aiError) {
        console.error(
          'Found AI error:',
          aiError
        )

        setFoundSubmitMessage(
          'Found item saved, but AI matching could not be completed yet.'
        )
      } else if (!aiResult?.success) {
        console.error(
          'Found AI failed:',
          aiResult?.error
        )

        setFoundSubmitMessage(
          'Found item saved, but AI matching could not be completed yet.'
        )
      } else {
        /*
         * IMPORTANT:
         * Edge Function returns "match"
         * not "matches".
         */
        const match =
          aiResult?.match || null

        if (match) {
          const score =
            Number(
              match.similarity_score
            ) || 0

          setFoundSubmitMessage(
            `Found item submitted! Nexora found a ${score.toFixed(
              2
            )}% potential match. 🔎`
          )
        } else {
          setFoundSubmitMessage(
            'Found item submitted and AI matching completed. No potential match yet. ✅'
          )
        }
      }

      setFoundTitle('')
      setFoundDescription('')
      setFoundCategory('')
      setFoundBrand('')
      setFoundColor('')
      setFoundLocation('')
      setFoundDate('')
      setFoundImage(null)

      if (foundImagePreview) {
        URL.revokeObjectURL(
          foundImagePreview
        )
      }

      setFoundImagePreview('')

      const imageInput =
        document.getElementById(
          'found-item-image'
        )

      if (imageInput) {
        imageInput.value = ''
      }

      await new Promise(resolve =>
        setTimeout(resolve, 500)
      )

      await refreshAllData()

    } catch (error) {
      console.error(
        'Found item submission error:',
        error
      )

      setFoundSubmitMessage(
        error?.message ||
          'Something went wrong while reporting the item.'
      )
    } finally {
      setLoading(false)
    }
  }

  /* =========================================
     LOGIN / SIGNUP
     
     KEEPING YOUR FLIP LOGIN ANIMATION
  ========================================= */

  if (!user) {
    return (
      <div className="login-wrapper">

        <div
          className={`flip-scene ${
            flipped ? 'flipped' : ''
          }`}
        >

          <div className="flip-card">

            {/* LOGIN */}

            <div className="glass-circle front">

              <div className="accent-ring"></div>

              <form
                className="login-form"
                onSubmit={handleLogin}
              >

                <div className="brand-mini">
                  <span>N</span>
                  <strong>Nexora</strong>
                </div>

                <h1>Welcome Back</h1>

                <div className="subtitle">
                  Sign in to your AI Lost &amp; Found account
                </div>

                <div className="input-box">

                  <i className="fa-solid fa-envelope"></i>

                  <input
                    type="email"
                    placeholder="Email address"
                    value={loginEmail}
                    onChange={event =>
                      setLoginEmail(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

                <div className="input-box">

                  <i className="fa-solid fa-lock"></i>

                  <input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={event =>
                      setLoginPassword(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

                <button
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? 'Signing In...'
                    : 'Sign In'}
                </button>

                <div className="signup-text">

                  Don't have an account?{' '}

                  <a
                    href="#signup"
                    onClick={event => {
                      event.preventDefault()
                      setFlipped(true)
                      setMessage('')
                    }}
                  >
                    Create one
                  </a>

                </div>

                {message && (
                  <div className="auth-message">
                    {message}
                  </div>
                )}

              </form>

            </div>

            {/* SIGNUP */}

            <div className="glass-circle back">

              <div className="accent-ring"></div>

              <form
                className="login-form"
                onSubmit={handleSignup}
              >

                <div className="brand-mini">
                  <span>N</span>
                  <strong>Nexora</strong>
                </div>

                <h1>Join Nexora</h1>

                <div className="subtitle">
                  Create your AI Lost &amp; Found account
                </div>

                <div className="input-box">

                  <i className="fa-solid fa-user"></i>

                  <input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={event =>
                      setFullName(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

                <div className="input-box">

                  <i className="fa-solid fa-envelope"></i>

                  <input
                    type="email"
                    placeholder="Email address"
                    value={signupEmail}
                    onChange={event =>
                      setSignupEmail(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

                <div className="input-box">

                  <i className="fa-solid fa-lock"></i>

                  <input
                    type="password"
                    placeholder="Password"
                    value={signupPassword}
                    onChange={event =>
                      setSignupPassword(
                        event.target.value
                      )
                    }
                    required
                    minLength={6}
                  />

                </div>

                <button
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? 'Creating...'
                    : 'Create Account'}
                </button>

                <div className="signup-text">

                  Already have an account?{' '}

                  <a
                    href="#login"
                    onClick={event => {
                      event.preventDefault()
                      setFlipped(false)
                      setMessage('')
                    }}
                  >
                    Sign in
                  </a>

                </div>

                {message && (
                  <div className="auth-message">
                    {message}
                  </div>
                )}

              </form>

            </div>

          </div>

        </div>

      </div>
    )
  }
  /* =========================================
     MAIN APP
  ========================================= */

  return (
    <div className="nexora-app">

      {/* =========================================
          SIDEBAR
      ========================================= */}

      <aside className="sidebar">

        <div className="sidebar-brand">

          <div className="logo-mark">
            N
          </div>

          <div>
            <h2>Nexora</h2>
            <span>
              AI Lost &amp; Found
            </span>
          </div>

        </div>

        <div className="nav-label">
          WORKSPACE
        </div>

        <nav className="sidebar-nav">

          <button
            type="button"
            className={
              activePage === 'Dashboard'
                ? 'nav-active'
                : ''
            }
            onClick={() =>
              setActivePage('Dashboard')
            }
          >
            <i className="fa-solid fa-chart-pie"></i>
            Dashboard
          </button>

          <button
            type="button"
            className={
              activePage === 'Find'
                ? 'nav-active'
                : ''
            }
            onClick={() =>
              setActivePage('Find')
            }
          >
            <i className="fa-solid fa-magnifying-glass"></i>
            Find Lost Item
          </button>

          <button
            type="button"
            className={
              activePage === 'Report'
                ? 'nav-active'
                : ''
            }
            onClick={() =>
              setActivePage('Report')
            }
          >
            <i className="fa-solid fa-box-open"></i>
            Report Found Item
          </button>

          <button
            type="button"
            className={
              activePage === 'Matches'
                ? 'nav-active'
                : ''
            }
            onClick={() =>
              setActivePage('Matches')
            }
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            AI Matches

            <span className="nav-count">
              {matchCount}
            </span>
          </button>

          <button
            type="button"
            className={
              activePage === 'Activity'
                ? 'nav-active'
                : ''
            }
            onClick={() =>
              setActivePage('Activity')
            }
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            Activity
          </button>

        </nav>

        <div className="sidebar-bottom">

          <button
            type="button"
            className={
              activePage === 'Settings'
                ? 'nav-active'
                : ''
            }
            onClick={() =>
              setActivePage('Settings')
            }
          >
            <i className="fa-solid fa-gear"></i>
            Settings
          </button>

          <button
            type="button"
            onClick={handleLogout}
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            Sign Out
          </button>

        </div>

      </aside>

      {/* =========================================
          MAIN
      ========================================= */}

      <main className="dashboard-main">

        {/* HEADER */}

        <header className="dashboard-header">

          <div>

            <span className="overline">
              NEXORA AI PLATFORM
            </span>

            <h1>
              Good evening, {displayName} 👋
            </h1>

            <p>
              Your intelligent lost &amp; found assistant.
            </p>

          </div>

          <div className="header-right">

            {/* =====================================
                NOTIFICATIONS
            ===================================== */}

            <div
              style={{
                position: 'relative',
              }}
            >

              <button
                type="button"
                className="notification-btn"
                onClick={() =>
                  setNotificationOpen(
                    value => !value
                  )
                }
              >

                <i className="fa-regular fa-bell"></i>

                {notifications.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background:
                        '#ff4d6d',
                      border:
                        '2px solid #111827',
                    }}
                  ></span>
                )}

              </button>

              {notificationOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '55px',
                    width: '360px',
                    maxWidth:
                      'calc(100vw - 40px)',
                    background:
                      'rgba(18, 24, 38, 0.98)',
                    border:
                      '1px solid rgba(255,255,255,0.1)',
                    borderRadius:
                      '16px',
                    boxShadow:
                      '0 20px 50px rgba(0,0,0,0.35)',
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >

                  <div
                    style={{
                      padding:
                        '18px 20px',
                      borderBottom:
                        '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems:
                        'center',
                    }}
                  >

                    <strong>
                      Notifications
                    </strong>

                    <span
                      style={{
                        fontSize:
                          '12px',
                        opacity: 0.6,
                      }}
                    >
                      {notifications.length}
                    </span>

                  </div>

                  {notifications.length === 0 ? (

                    <div
                      style={{
                        padding:
                          '30px 20px',
                        textAlign:
                          'center',
                        opacity: 0.7,
                      }}
                    >

                      <i
                        className="fa-regular fa-bell"
                        style={{
                          fontSize:
                            '28px',
                          marginBottom:
                            '12px',
                        }}
                      ></i>

                      <p>
                        No new notifications
                      </p>

                    </div>

                  ) : (

                    <div
                      style={{
                        maxHeight:
                          '360px',
                        overflowY:
                          'auto',
                      }}
                    >

                      {notifications.map(
                        notification => (
                          <button
                            key={
                              notification.id
                            }
                            type="button"
                            onClick={() => {
                              setNotificationOpen(
                                false
                              )
                              setActivePage(
                                'Matches'
                              )
                            }}
                            style={{
                              width:
                                '100%',
                              border: 'none',
                              background:
                                'transparent',
                              color:
                                'inherit',
                              textAlign:
                                'left',
                              padding:
                                '16px 20px',
                              display:
                                'flex',
                              gap:
                                '13px',
                              cursor:
                                'pointer',
                              borderBottom:
                                '1px solid rgba(255,255,255,0.06)',
                            }}
                          >

                            <div
                              style={{
                                width:
                                  '38px',
                                height:
                                  '38px',
                                minWidth:
                                  '38px',
                                borderRadius:
                                  '50%',
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                justifyContent:
                                  'center',
                                background:
                                  'rgba(120,100,255,0.15)',
                              }}
                            >
                              <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </div>

                            <div>

                              <strong
                                style={{
                                  display:
                                    'block',
                                  marginBottom:
                                    '4px',
                                }}
                              >
                                {
                                  notification.title
                                }
                              </strong>

                              <span
                                style={{
                                  display:
                                    'block',
                                  fontSize:
                                    '13px',
                                  opacity:
                                    0.7,
                                  lineHeight:
                                    '1.4',
                                }}
                              >
                                {
                                  notification.text
                                }
                              </span>

                              <small
                                style={{
                                  display:
                                    'block',
                                  marginTop:
                                    '5px',
                                  opacity:
                                    0.45,
                                }}
                              >
                                {new Date(
                                  notification.date
                                ).toLocaleString()}
                              </small>

                            </div>

                          </button>
                        )
                      )}

                    </div>

                  )}

                </div>
              )}

            </div>

            <div className="profile-chip">

              <div className="profile-avatar">
                {displayName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>

                <strong>
                  {displayName}
                </strong>

                <small>
                  {user.email}
                </small>

              </div>

            </div>

          </div>

        </header>

        {/* =========================================
            DASHBOARD
        ========================================= */}

        {activePage === 'Dashboard' && (
          <>

            <section className="ai-hero">

              <div className="hero-text">

                <div className="ai-badge">
                  <span className="pulse-dot"></span>
                  AI MATCHING ENGINE
                </div>

                <h2>
                  Find what you lost.
                  <br />
                  <span>
                    Faster with AI.
                  </span>
                </h2>

                <p>
                  Upload an image or report a found item.
                  Nexora analyzes visual features and helps
                  identify potential matches.
                </p>

                <div className="hero-actions">

                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() =>
                      setActivePage('Find')
                    }
                  >
                    <i className="fa-solid fa-camera"></i>
                    Find My Item
                  </button>

                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() =>
                      setActivePage('Report')
                    }
                  >
                    <i className="fa-solid fa-plus"></i>
                    Report Found Item
                  </button>

                </div>

              </div>

              <div className="hero-ai-visual">

                <div className="orbital orbital-one"></div>
                <div className="orbital orbital-two"></div>

                <div className="ai-orb">
                  <i className="fa-solid fa-brain"></i>
                </div>

                <div className="floating-card floating-one">
                  <i className="fa-solid fa-image"></i>
                  <span>
                    Image Analysis
                  </span>
                </div>

                <div className="floating-card floating-two">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>
                    AI Matching
                  </span>
                </div>

              </div>

            </section>

            {/* STATS */}

            <section className="stats">

              <div className="stat">

                <div className="stat-icon">
                  <i className="fa-solid fa-location-dot"></i>
                </div>

                <div>
                  <span>
                    Lost Items
                  </span>

                  <strong>
                    {lostItemCount}
                  </strong>

                  <small>
                    Active reports
                  </small>
                </div>

              </div>

              <div className="stat">

                <div className="stat-icon">
                  <i className="fa-solid fa-box-open"></i>
                </div>

                <div>
                  <span>
                    Found Items
                  </span>

                  <strong>
                    {foundItemCount}
                  </strong>

                  <small>
                    Community reports
                  </small>
                </div>

              </div>

              <div className="stat">

                <div className="stat-icon">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>

                <div>
                  <span>
                    AI Matches
                  </span>

                  <strong>
                    {matchCount}
                  </strong>

                  <small>
                    Potential matches
                  </small>
                </div>

              </div>

              <div className="stat">

                <div className="stat-icon">
                  <i className="fa-solid fa-circle-check"></i>
                </div>

                <div>
                  <span>
                    Returned
                  </span>

                  <strong>
                    0
                  </strong>

                  <small>
                    Items reunited
                  </small>
                </div>

              </div>

            </section>

            {/* WORKFLOW */}

            <section className="lower-grid">

              <div className="panel">

                <div className="panel-heading">

                  <div>
                    <span className="overline">
                      INTELLIGENCE
                    </span>

                    <h3>
                      Nexora AI workflow
                    </h3>
                  </div>

                  <div className="ready">
                    <span></span>
                    AI Ready
                  </div>

                </div>

                <div className="workflow">

                  <div className="workflow-step">

                    <div className="step-number">
                      01
                    </div>

                    <div className="step-icon">
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                    </div>

                    <div>
                      <strong>
                        Upload
                      </strong>

                      <p>
                        Add a photo of your lost or found item.
                      </p>
                    </div>

                  </div>

                  <div className="workflow-line"></div>

                  <div className="workflow-step">

                    <div className="step-number">
                      02
                    </div>

                    <div className="step-icon">
                      <i className="fa-solid fa-brain"></i>
                    </div>

                    <div>
                      <strong>
                        Analyze
                      </strong>

                      <p>
                        AI extracts visual features from the item image.
                      </p>
                    </div>

                  </div>

                  <div className="workflow-line"></div>

                  <div className="workflow-step">

                    <div className="step-number">
                      03
                    </div>

                    <div className="step-icon">
                      <i className="fa-solid fa-link"></i>
                    </div>

                    <div>
                      <strong>
                        Match
                      </strong>

                      <p>
                        Nexora compares images and generates a similarity score.
                      </p>
                    </div>

                  </div>

                </div>

              </div>

            </section>

          </>
        )}

        {/* =========================================
            FIND LOST ITEM
        ========================================= */}

        {activePage === 'Find' && (
          <section className="lost-item-page">

            <div className="form-header">

              <div>

                <span className="overline">
                  LOST ITEM REPORT
                </span>

                <h2>
                  Find Your Lost Item
                </h2>

                <p>
                  Tell Nexora about the item you lost.
                  Uploading a clear image helps the AI matching
                  system identify potential matches.
                </p>

              </div>

              <div className="form-status">
                <span className="pulse-dot"></span>
                AI READY
              </div>

            </div>

            <form
              className="lost-item-form"
              onSubmit={
                handleLostItemSubmit
              }
            >

              <div className="form-grid">

                <div className="form-field full">
                  <label htmlFor="lost-title">
                    Item Name *
                  </label>

                  <input
                    id="lost-title"
                    type="text"
                    placeholder="Example: Black Samsung Galaxy phone"
                    value={lostTitle}
                    onChange={event =>
                      setLostTitle(
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="form-field">

                  <label htmlFor="lost-category">
                    Category *
                  </label>

                  <select
                    id="lost-category"
                    value={lostCategory}
                    onChange={event =>
                      setLostCategory(
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      Select category
                    </option>
                    <option value="Electronics">
                      Electronics
                    </option>
                    <option value="Wallet">
                      Wallet
                    </option>
                    <option value="Keys">
                      Keys
                    </option>
                    <option value="Bag">
                      Bag
                    </option>
                    <option value="Clothing">
                      Clothing
                    </option>
                    <option value="Documents">
                      Documents
                    </option>
                    <option value="Jewelry">
                      Jewelry
                    </option>
                    <option value="Accessories">
                      Accessories
                    </option>
                    <option value="Other">
                      Other
                    </option>
                  </select>

                </div>

                <div className="form-field">

                  <label htmlFor="lost-brand">
                    Brand
                  </label>

                  <input
                    id="lost-brand"
                    type="text"
                    placeholder="Example: Samsung"
                    value={lostBrand}
                    onChange={event =>
                      setLostBrand(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-field">

                  <label htmlFor="lost-color">
                    Color
                  </label>

                  <input
                    id="lost-color"
                    type="text"
                    placeholder="Example: Black"
                    value={lostColor}
                    onChange={event =>
                      setLostColor(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-field">

                  <label htmlFor="lost-date">
                    Date Lost
                  </label>

                  <input
                    id="lost-date"
                    type="date"
                    value={lostDate}
                    onChange={event =>
                      setLostDate(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-field full">

                  <label htmlFor="lost-location">
                    Where did you lose it? *
                  </label>

                  <input
                    id="lost-location"
                    type="text"
                    placeholder="Example: College library, Hyderabad"
                    value={lostLocation}
                    onChange={event =>
                      setLostLocation(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

                <div className="form-field full">

                  <label htmlFor="lost-description">
                    Description
                  </label>

                  <textarea
                    id="lost-description"
                    placeholder="Add identifying details..."
                    value={lostDescription}
                    onChange={event =>
                      setLostDescription(
                        event.target.value
                      )
                    }
                    rows="5"
                  />

                </div>

              </div>

              <div className="upload-section">

                <div className="upload-heading">

                  <div>

                    <label>
                      Item Image *
                    </label>

                    <p>
                      JPG, PNG or WebP • Maximum 5 MB
                    </p>

                  </div>

                </div>

                <label
                  htmlFor="lost-item-image"
                  className="image-upload-box"
                >

                  {imagePreview ? (

                    <div className="image-preview-wrapper">

                      <img
                        src={imagePreview}
                        alt="Lost item preview"
                        className="image-preview"
                      />

                      <div className="image-overlay">
                        <i className="fa-solid fa-camera"></i>
                        Change Image
                      </div>

                    </div>

                  ) : (

                    <div className="upload-empty">

                      <div className="upload-icon">
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                      </div>

                      <strong>
                        Upload item image
                      </strong>

                      <span>
                        Click to choose a photo
                      </span>

                    </div>

                  )}

                </label>

                <input
                  id="lost-item-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handleImageChange
                  }
                  hidden
                />

              </div>

              {submitMessage && (
                <div className="submit-message">
                  {submitMessage}
                </div>
              )}

              <div className="form-actions">

                <button
                  type="button"
                  className="secondary-form-btn"
                  onClick={() => {
                    setActivePage(
                      'Dashboard'
                    )
                    setSubmitMessage('')
                  }}
                  disabled={loading}
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn submit-item-btn"
                  disabled={loading}
                >

                  <i
                    className={
                      loading
                        ? 'fa-solid fa-spinner fa-spin'
                        : 'fa-solid fa-paper-plane'
                    }
                  ></i>

                  {loading
                    ? 'Submitting...'
                    : 'Submit Lost Item'}

                </button>

              </div>

            </form>

          </section>
        )}
        {/* =========================================
            REPORT FOUND ITEM
        ========================================= */}

        {activePage === 'Report' && (
          <section className="lost-item-page">

            <div className="form-header">

              <div>

                <span className="overline">
                  FOUND ITEM REPORT
                </span>

                <h2>
                  Report a Found Item
                </h2>

                <p>
                  Found something that may belong to someone?
                  Add the details and upload a clear image so Nexora
                  can compare it with reported lost items.
                </p>

              </div>

              <div className="form-status">
                <span className="pulse-dot"></span>
                AI READY
              </div>

            </div>

            <form
              className="lost-item-form"
              onSubmit={
                handleFoundItemSubmit
              }
            >

              <div className="form-grid">

                <div className="form-field full">

                  <label htmlFor="found-title">
                    Item Name *
                  </label>

                  <input
                    id="found-title"
                    type="text"
                    placeholder="Example: Black Samsung Galaxy phone"
                    value={foundTitle}
                    onChange={event =>
                      setFoundTitle(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

                <div className="form-field">

                  <label htmlFor="found-category">
                    Category *
                  </label>

                  <select
                    id="found-category"
                    value={foundCategory}
                    onChange={event =>
                      setFoundCategory(
                        event.target.value
                      )
                    }
                    required
                  >

                    <option value="">
                      Select category
                    </option>

                    <option value="Electronics">
                      Electronics
                    </option>

                    <option value="Wallet">
                      Wallet
                    </option>

                    <option value="Keys">
                      Keys
                    </option>

                    <option value="Bag">
                      Bag
                    </option>

                    <option value="Clothing">
                      Clothing
                    </option>

                    <option value="Documents">
                      Documents
                    </option>

                    <option value="Jewelry">
                      Jewelry
                    </option>

                    <option value="Accessories">
                      Accessories
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>

                <div className="form-field">

                  <label htmlFor="found-brand">
                    Brand
                  </label>

                  <input
                    id="found-brand"
                    type="text"
                    placeholder="Example: Samsung"
                    value={foundBrand}
                    onChange={event =>
                      setFoundBrand(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-field">

                  <label htmlFor="found-color">
                    Color
                  </label>

                  <input
                    id="found-color"
                    type="text"
                    placeholder="Example: Black"
                    value={foundColor}
                    onChange={event =>
                      setFoundColor(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-field">

                  <label htmlFor="found-date">
                    Date Found
                  </label>

                  <input
                    id="found-date"
                    type="date"
                    value={foundDate}
                    onChange={event =>
                      setFoundDate(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-field full">

                  <label htmlFor="found-location">
                    Where did you find it? *
                  </label>

                  <input
                    id="found-location"
                    type="text"
                    placeholder="Example: College library, Hyderabad"
                    value={foundLocation}
                    onChange={event =>
                      setFoundLocation(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

                <div className="form-field full">

                  <label htmlFor="found-description">
                    Description
                  </label>

                  <textarea
                    id="found-description"
                    placeholder="Add identifying details..."
                    value={foundDescription}
                    onChange={event =>
                      setFoundDescription(
                        event.target.value
                      )
                    }
                    rows="5"
                  />

                </div>

              </div>

              <div className="upload-section">

                <div className="upload-heading">

                  <div>

                    <label>
                      Found Item Image *
                    </label>

                    <p>
                      JPG, PNG or WebP • Maximum 5 MB
                    </p>

                  </div>

                </div>

                <label
                  htmlFor="found-item-image"
                  className="image-upload-box"
                >

                  {foundImagePreview ? (

                    <div className="image-preview-wrapper">

                      <img
                        src={foundImagePreview}
                        alt="Found item preview"
                        className="image-preview"
                      />

                      <div className="image-overlay">
                        <i className="fa-solid fa-camera"></i>
                        Change Image
                      </div>

                    </div>

                  ) : (

                    <div className="upload-empty">

                      <div className="upload-icon">
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                      </div>

                      <strong>
                        Upload found item image
                      </strong>

                      <span>
                        Click to choose a photo
                      </span>

                    </div>

                  )}

                </label>

                <input
                  id="found-item-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handleFoundImageChange
                  }
                  hidden
                />

              </div>

              {foundSubmitMessage && (
                <div className="submit-message">
                  {foundSubmitMessage}
                </div>
              )}

              <div className="form-actions">

                <button
                  type="button"
                  className="secondary-form-btn"
                  onClick={() => {
                    setActivePage(
                      'Dashboard'
                    )
                    setFoundSubmitMessage('')
                  }}
                  disabled={loading}
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn submit-item-btn"
                  disabled={loading}
                >

                  <i
                    className={
                      loading
                        ? 'fa-solid fa-spinner fa-spin'
                        : 'fa-solid fa-paper-plane'
                    }
                  ></i>

                  {loading
                    ? 'Submitting...'
                    : 'Report Found Item'}

                </button>

              </div>

            </form>

          </section>
        )}

        {/* =========================================
            AI MATCHES
        ========================================= */}

        {activePage === 'Matches' && (
          <section className="placeholder-page">

            <div
              style={{
                width: '100%',
                maxWidth: '1100px',
              }}
            >

              <div
                className="form-header"
                style={{
                  textAlign: 'left',
                }}
              >

                <div>

                  <span className="overline">
                    NEXORA INTELLIGENCE
                  </span>

                  <h2>
                    AI Matches
                  </h2>

                  <p>
                    Visual matches detected by Nexora AI.
                    Your similarity score is based on the item image.
                  </p>

                </div>

                <div className="form-status">
                  <span className="pulse-dot"></span>
                  {matchCount} MATCH
                  {matchCount === 1
                    ? ''
                    : 'ES'}
                </div>

              </div>

              {dataLoading ? (

                <div className="empty-state">

                  <div className="placeholder-icon">
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  </div>

                  <h2>
                    Loading AI matches...
                  </h2>

                  <p>
                    Nexora is checking your matched items.
                  </p>

                </div>

              ) : matches.length === 0 ? (

                <div className="empty-state">

                  <div className="placeholder-icon">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                  </div>

                  <span className="overline">
                    AI MATCHING
                  </span>

                  <h2>
                    No potential matches yet
                  </h2>

                  <p>
                    When Nexora finds a visual match,
                    it will appear here automatically.
                  </p>

                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() =>
                      setActivePage('Find')
                    }
                  >
                    <i className="fa-solid fa-camera"></i>
                    Report Lost Item
                  </button>

                </div>

              ) : (

                <div
                  style={{
                    display: 'grid',
                    gap: '20px',
                    marginTop: '25px',
                  }}
                >

                  {matches.map(match => {

                    const score =
                      Number(
                        match.similarity_score
                      ) || 0

                    const lostTitle =
                      match.lostItem?.title ||
                      'Lost Item'

                    const foundTitle =
                      match.foundItem?.title ||
                      'Found Item'

                    const isMyLost =
                      match.isMyLostItem

                    return (

                      <div
                        className="panel"
                        key={match.id}
                        style={{
                          padding: '28px',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >

                        {/* TOP */}

                        <div
                          style={{
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'flex-start',
                            gap: '20px',
                            flexWrap:
                              'wrap',
                          }}
                        >

                          <div>

                            <div
                              style={{
                                display:
                                  'inline-flex',
                                alignItems:
                                  'center',
                                gap: '7px',
                                padding:
                                  '7px 12px',
                                borderRadius:
                                  '999px',
                                background:
                                  'rgba(100, 90, 255, 0.12)',
                                fontSize:
                                  '11px',
                                fontWeight:
                                  '700',
                                letterSpacing:
                                  '1px',
                              }}
                            >

                              <span
                                style={{
                                  width:
                                    '7px',
                                  height:
                                    '7px',
                                  borderRadius:
                                    '50%',
                                  background:
                                    '#7c6cff',
                                }}
                              ></span>

                              AI POTENTIAL MATCH

                            </div>

                            <h3
                              style={{
                                marginTop:
                                  '12px',
                                marginBottom:
                                  '5px',
                                fontSize:
                                  '22px',
                              }}
                            >
                              {lostTitle}
                              {' ↔ '}
                              {foundTitle}
                            </h3>

                            <p
                              style={{
                                margin: 0,
                                opacity: 0.65,
                              }}
                            >
                              {isMyLost
                                ? 'Your lost item matched with a reported found item.'
                                : 'Your found item matched with a reported lost item.'}
                            </p>

                          </div>

                          {/* SCORE */}

                          <div
                            style={{
                              minWidth:
                                '130px',
                              textAlign:
                                'center',
                              padding:
                                '15px 20px',
                              borderRadius:
                                '16px',
                              background:
                                'rgba(100,90,255,0.10)',
                            }}
                          >

                            <div
                              style={{
                                fontSize:
                                  '34px',
                                fontWeight:
                                  '900',
                                lineHeight:
                                  1,
                              }}
                            >
                              {score.toFixed(
                                2
                              )}%
                            </div>

                            <small
                              style={{
                                opacity:
                                  0.6,
                              }}
                            >
                              visual similarity
                            </small>

                          </div>

                        </div>

                        {/* ITEMS */}

                        <div
                          style={{
                            display:
                              'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(250px, 1fr))',
                            gap:
                              '18px',
                            marginTop:
                              '25px',
                          }}
                        >

                          {/* LOST CARD */}

                          <div
                            style={{
                              padding:
                                '20px',
                              borderRadius:
                                '14px',
                              background:
                                'rgba(255,255,255,0.035)',
                              border:
                                '1px solid rgba(255,255,255,0.07)',
                            }}
                          >

                            <span className="overline">
                              LOST ITEM
                            </span>

                            <h4
                              style={{
                                margin:
                                  '9px 0',
                                fontSize:
                                  '18px',
                              }}
                            >
                              {lostTitle}
                            </h4>

                            {match.lostItem?.category && (
                              <p>
                                <strong>
                                  Category:
                                </strong>{' '}
                                {
                                  match.lostItem
                                    .category
                                }
                              </p>
                            )}

                            {match.lostItem?.color && (
                              <p>
                                <strong>
                                  Color:
                                </strong>{' '}
                                {
                                  match.lostItem
                                    .color
                                }
                              </p>
                            )}

                            {match.lostItem?.brand && (
                              <p>
                                <strong>
                                  Brand:
                                </strong>{' '}
                                {
                                  match.lostItem
                                    .brand
                                }
                              </p>
                            )}

                            {match.lostItem?.location && (
                              <p>
                                📍{' '}
                                {
                                  match.lostItem
                                    .location
                                }
                              </p>
                            )}

                          </div>

                          {/* FOUND CARD */}

                          <div
                            style={{
                              padding:
                                '20px',
                              borderRadius:
                                '14px',
                              background:
                                'rgba(255,255,255,0.035)',
                              border:
                                '1px solid rgba(255,255,255,0.07)',
                            }}
                          >

                            <span className="overline">
                              FOUND ITEM
                            </span>

                            <h4
                              style={{
                                margin:
                                  '9px 0',
                                fontSize:
                                  '18px',
                              }}
                            >
                              {foundTitle}
                            </h4>

                            {match.foundItem?.category && (
                              <p>
                                <strong>
                                  Category:
                                </strong>{' '}
                                {
                                  match.foundItem
                                    .category
                                }
                              </p>
                            )}

                            {match.foundItem?.color && (
                              <p>
                                <strong>
                                  Color:
                                </strong>{' '}
                                {
                                  match.foundItem
                                    .color
                                }
                              </p>
                            )}

                            {match.foundItem?.brand && (
                              <p>
                                <strong>
                                  Brand:
                                </strong>{' '}
                                {
                                  match.foundItem
                                    .brand
                                }
                              </p>
                            )}

                            {match.foundItem?.location && (
                              <p>
                                📍{' '}
                                {
                                  match.foundItem
                                    .location
                                }
                              </p>
                            )}

                          </div>

                        </div>

                        {/* AI INFORMATION */}

                        <div
                          style={{
                            marginTop:
                              '20px',
                            paddingTop:
                              '18px',
                            borderTop:
                              '1px solid rgba(255,255,255,0.08)',
                            display:
                              'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'center',
                            gap:
                              '15px',
                            flexWrap:
                              'wrap',
                          }}
                        >

                          <span
                            style={{
                              opacity:
                                0.65,
                            }}
                          >
                            <i className="fa-solid fa-brain"></i>{' '}
                            DINOv2 AI visual analysis
                          </span>

                          <strong>
                            {match.modelName ||
                              match.model_name ||
                              'facebook/dinov2-base'}
                          </strong>

                        </div>

                      </div>

                    )
                  })}

                </div>

              )}

            </div>

          </section>
        )}

        {/* =========================================
            ACTIVITY
        ========================================= */}

        {activePage === 'Activity' && (
          <section className="placeholder-page">

            <div
              style={{
                width: '100%',
                maxWidth: '1000px',
              }}
            >

              <div
                className="form-header"
                style={{
                  textAlign: 'left',
                }}
              >

                <div>

                  <span className="overline">
                    YOUR ACTIVITY
                  </span>

                  <h2>
                    Activity
                  </h2>

                  <p>
                    Everything you have reported and every
                    AI match Nexora has detected.
                  </p>

                </div>

              </div>

              {activity.length === 0 ? (

                <div className="empty-state">

                  <div className="placeholder-icon">
                    <i className="fa-solid fa-clock-rotate-left"></i>
                  </div>

                  <span className="overline">
                    ACTIVITY
                  </span>

                  <h2>
                    No activity yet
                  </h2>

                  <p>
                    Your lost items, found items and AI
                    matches will appear here.
                  </p>

                </div>

              ) : (

                <div
                  style={{
                    display:
                      'grid',
                    gap:
                      '12px',
                    marginTop:
                      '25px',
                  }}
                >

                  {activity.map(event => (

                    <div
                      className="panel"
                      key={event.id}
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap:
                          '18px',
                        padding:
                          '18px 22px',
                      }}
                    >

                      <div
                        style={{
                          width:
                            '48px',
                          height:
                            '48px',
                          minWidth:
                            '48px',
                          borderRadius:
                            '50%',
                          display:
                            'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          fontSize:
                            '20px',
                          background:
                            'rgba(100,90,255,0.10)',
                        }}
                      >

                        {event.type ===
                        'match'
                          ? '🎯'
                          : event.type ===
                            'lost'
                          ? '🔴'
                          : '🟢'}

                      </div>

                      <div
                        style={{
                          display:
                            'flex',
                          flexDirection:
                            'column',
                          gap:
                            '4px',
                        }}
                      >

                        <strong>
                          {event.title}
                        </strong>

                        {event.location && (
                          <span>
                            📍{' '}
                            {event.location}
                          </span>
                        )}

                        {event.date && (
                          <small
                            style={{
                              opacity:
                                0.5,
                            }}
                          >
                            {new Date(
                              event.date
                            ).toLocaleString()}
                          </small>
                        )}

                      </div>

                    </div>

                  ))}

                </div>

              )}

            </div>

          </section>
        )}

        {/* =========================================
            SETTINGS
        ========================================= */}

        {activePage === 'Settings' && (
          <section className="placeholder-page">

            <div className="placeholder-icon">
              <i className="fa-solid fa-gear"></i>
            </div>

            <span className="overline">
              NEXORA SETTINGS
            </span>

            <h2>
              Settings
            </h2>

            <p>
              Settings and profile customization will
              be connected next.
            </p>

            <button
              type="button"
              className="primary-btn"
              onClick={() =>
                setActivePage('Dashboard')
              }
            >
              <i className="fa-solid fa-arrow-left"></i>
              Back to Dashboard
            </button>

          </section>
        )}

      </main>

    </div>
  )
}

export default App